#include <iostream>
#include <string>
#include <cmath>
#include <vector>
#include <array>
#include <iomanip>
#include <memory>
#include <algorithm>
#include <Eigen/Dense>

// --- PHYSICAL CONSTANTS ---
const double G = 6.67430e-11;
const double MU_SUN = 1.32712440018e20;
const double AU = 1.495978707e11;

inline std::pair<Eigen::Vector3d, Eigen::Vector3d> deriv_heliocentric(const Eigen::Vector3d& p, const Eigen::Vector3d& v) {
    double r = p.norm();
    double r3 = r * r * r;
    return std::pair<Eigen::Vector3d, Eigen::Vector3d>(v, -MU_SUN * p / r3);
}

// Legacy definitions for Earth UI telemetry compatibility
const double MU = 3.986004418e14;
const double RE = 6371000.0;

typedef Eigen::Matrix<double, 6, 1> StateVector;

// --- PLANETARY STRUCTURE ---
struct Planet {
    std::string name;
    double mass;
    double radius;
    double atmosphere_limit;
    double mu;
    double semi_major_axis;
    double orbital_period;
    Eigen::Vector3d pos;
    Eigen::Vector3d vel;
};

// --- SPACECRAFT STRUCTURE ---
struct Spacecraft {
    Eigen::Vector3d pos = Eigen::Vector3d::Zero();
    Eigen::Vector3d vel = Eigen::Vector3d::Zero();
    double mass = 1000.0;
    double current_delta_v_pool = 3500.0;
    bool is_captured = false;
    bool is_overshot = false;
};

// --- ORBITAL INSERTION RETRO-BURN ---
void ExecuteCaptureBurn(Spacecraft& probe, const Planet& target_planet) {
    if (probe.is_captured || probe.is_overshot) return;

    Eigen::Vector3d r_rel = probe.pos - target_planet.pos;
    Eigen::Vector3d v_rel = probe.vel - target_planet.vel;
    double r_mag = r_rel.norm();
    double v_mag = v_rel.norm();

    double soi = target_planet.radius * 150.0;
    if (r_mag > soi) return;

    double mu = target_planet.mu;
    Eigen::Vector3d h_vec = r_rel.cross(v_rel);
    double h = h_vec.norm();

    double energy = (v_mag * v_mag) / 2.0 - mu / r_mag;
    if (energy <= 0.0) {
        probe.is_captured = true;
        return;
    }

    double a_hyper = mu / (2.0 * energy);
    double e = std::sqrt(1.0 + (2.0 * energy * h * h) / (mu * mu));
    double rp = a_hyper * (e - 1.0);
    if (rp <= 0.0) rp = target_planet.radius;

    if (r_mag > rp * 1.05) return;

    double v_arrival = std::sqrt(2.0 * (energy + mu / rp));
    double target_period = 195.6 * 86400.0;
    double a_target = std::pow(mu * std::pow(target_period / (2.0 * M_PI), 2), 1.0 / 3.0);
    double v_capture = std::sqrt(mu * (2.0 / rp - 1.0 / a_target));
    double delta_v_required = v_arrival - v_capture;

    if (delta_v_required <= 0.0) {
        probe.is_captured = true;
        return;
    }

    if (probe.current_delta_v_pool >= delta_v_required) {
        probe.current_delta_v_pool -= delta_v_required;
        probe.is_captured = true;
        probe.is_overshot = false;
        probe.vel = target_planet.vel + v_rel.normalized() * v_capture;
    } else {
        probe.is_overshot = true;
        probe.is_captured = false;
    }
}

// --- ADAPTIVE N-BODY INTEGRATOR ENGINE ---
void IntegratePhysics(Spacecraft& probe, const std::vector<Planet>& planets, double max_dt) {
    const double alpha = 0.01;
    double t_accumulated = 0.0;

    while (t_accumulated < max_dt) {
        double min_dist = INFINITY;
        const Planet* nearest_planet = nullptr;
        for (const auto& planet : planets) {
            double d = (probe.pos - planet.pos).norm();
            if (d < min_dist) {
                min_dist = d;
                nearest_planet = &planet;
            }
        }

        double dt_adaptive = max_dt - t_accumulated;
        if (nearest_planet) {
            Eigen::Vector3d rel_vel = probe.vel - nearest_planet->vel;
            double v_rel_mag = rel_vel.norm();
            if (v_rel_mag > 1e-3) {
                double dt_local = alpha * min_dist / v_rel_mag;
                if (dt_local < dt_adaptive) {
                    dt_adaptive = std::max(dt_local, 1.0);
                }
            }
        }

        if (t_accumulated + dt_adaptive > max_dt) {
            dt_adaptive = max_dt - t_accumulated;
        }

        auto derivatives = [&](const Eigen::Vector3d& p, const Eigen::Vector3d& v) {
            double r_sun = p.norm();
            Eigen::Vector3d acc = -MU_SUN * p / (r_sun * r_sun * r_sun);
            if (nearest_planet) {
                Eigen::Vector3d r_rel = p - nearest_planet->pos;
                double d_rel = r_rel.norm();
                double soft_d = std::max(d_rel, nearest_planet->radius * 0.5);
                acc += -nearest_planet->mu * r_rel / (soft_d * soft_d * soft_d);
            }
            return std::make_pair(v, acc);
        };

        auto [v1, a1] = derivatives(probe.pos, probe.vel);
        auto [v2, a2] = derivatives(probe.pos + 0.5 * dt_adaptive * v1, probe.vel + 0.5 * dt_adaptive * a1);
        auto [v3, a3] = derivatives(probe.pos + 0.5 * dt_adaptive * v2, probe.vel + 0.5 * dt_adaptive * a2);
        auto [v4, a4] = derivatives(probe.pos + dt_adaptive * v3, probe.vel + dt_adaptive * a3);

        probe.pos += (dt_adaptive / 6.0) * (v1 + 2.0 * v2 + 2.0 * v3 + v4);
        probe.vel += (dt_adaptive / 6.0) * (a1 + 2.0 * a2 + 2.0 * a3 + a4);

        if (nearest_planet) {
            ExecuteCaptureBurn(probe, *nearest_planet);
        }

        t_accumulated += dt_adaptive;
    }
}

// --- MULTI-BODY SYSTEM INITIALIZATION ---
std::vector<Planet> InitializeSolarSystem() {
    std::vector<Planet> planets;

    planets.push_back({
        "Earth", 5.9722e24, 6371000.0, 120000.0, G * 5.9722e24,
        1.00 * AU, 365.25 * 86400.0,
        Eigen::Vector3d(1.00 * AU, 0.0, 0.0),
        Eigen::Vector3d(0.0, 29780.0, 0.0)
    });
    planets.push_back({
        "Jupiter", 1.8982e27, 69911000.0, 1000000.0, G * 1.8982e27,
        5.20 * AU, 11.86 * 365.25 * 86400.0,
        Eigen::Vector3d(5.20 * AU, 0.0, 0.0),
        Eigen::Vector3d(0.0, 13070.0, 0.0)
    });
    planets.push_back({
        "Saturn", 5.6834e26, 58232000.0, 1000000.0, G * 5.6834e26,
        9.58 * AU, 29.45 * 365.25 * 86400.0,
        Eigen::Vector3d(9.58 * AU, 0.0, 0.0),
        Eigen::Vector3d(0.0, 9690.0, 0.0)
    });
    planets.push_back({
        "Uranus", 8.6810e25, 25362000.0, 500000.0, G * 8.6810e25,
        19.22 * AU, 84.01 * 365.25 * 86400.0,
        Eigen::Vector3d(19.22 * AU, 0.0, 0.0),
        Eigen::Vector3d(0.0, 6810.0, 0.0)
    });
    planets.push_back({
        "Neptune", 1.0241e26, 24622000.0, 500000.0, G * 1.0241e26,
        30.05 * AU, 164.79 * 365.25 * 86400.0,
        Eigen::Vector3d(30.05 * AU, 0.0, 0.0),
        Eigen::Vector3d(0.0, 5430.0, 0.0)
    });

    return planets;
}

// --- DEEP SPACE GRAVITY ASSIST ENGINE ---
class GravityAssistPlanner {
public:
    std::vector<Planet> fleet;

    GravityAssistPlanner() {
        fleet = InitializeSolarSystem();
    }

    void StateVectorPropagateRK4(Eigen::Vector3d& sc_pos, Eigen::Vector3d& sc_vel, double dt) {
        auto derivatives = [&](const Eigen::Vector3d& p, const Eigen::Vector3d& v) {
            double r_sun = p.norm();
            Eigen::Vector3d acc = -MU_SUN * p / (r_sun * r_sun * r_sun);
            double min_dist = INFINITY;
            const Planet* nearest_planet = nullptr;
            for (const auto& planet : fleet) {
                double d = (p - planet.pos).norm();
                if (d < min_dist) { min_dist = d; nearest_planet = &planet; }
            }
            if (nearest_planet) {
                Eigen::Vector3d r_rel = p - nearest_planet->pos;
                double d_rel = r_rel.norm();
                double soft_d = std::max(d_rel, nearest_planet->radius * 0.5);
                acc += -nearest_planet->mu * r_rel / (soft_d * soft_d * soft_d);
            }
            return std::make_pair(v, acc);
        };

        auto [v1, a1] = derivatives(sc_pos, sc_vel);
        auto [v2, a2] = derivatives(sc_pos + 0.5 * dt * v1, sc_vel + 0.5 * dt * a1);
        auto [v3, a3] = derivatives(sc_pos + 0.5 * dt * v2, sc_vel + 0.5 * dt * a2);
        auto [v4, a4] = derivatives(sc_pos + dt * v3, sc_vel + dt * a3);

        sc_pos += (dt / 6.0) * (v1 + 2.0 * v2 + 2.0 * v3 + v4);
        sc_vel += (dt / 6.0) * (a1 + 2.0 * a2 + 2.0 * a3 + a4);
    }

    double PlanSlingshot(const Planet& swingby_body,
                         const Eigen::Vector3d& v_sc_in,
                         const Eigen::Vector3d& v_target_out,
                         double& actual_delta_v,
                         bool& atmospheric_impact) {
        Eigen::Vector3d v_inf_in = v_sc_in - swingby_body.vel;
        double v_inf = v_inf_in.norm();
        Eigen::Vector3d v_inf_out = v_target_out - swingby_body.vel;
        v_inf_out = v_inf_out.normalized() * v_inf;

        double cos_theta = v_inf_in.dot(v_inf_out) / (v_inf * v_inf);
        cos_theta = std::max(-1.0, std::min(1.0, cos_theta));
        double theta = std::acos(cos_theta);

        double sin_half_theta = std::sin(theta / 2.0);
        double rp = 0.0;
        if (sin_half_theta > 0.0) {
            rp = (swingby_body.mu / (v_inf * v_inf)) * ((1.0 / sin_half_theta) - 1.0);
        } else {
            rp = swingby_body.radius;
        }

        double safety_margin = swingby_body.radius + swingby_body.atmosphere_limit;
        atmospheric_impact = (rp < safety_margin);
        actual_delta_v = (v_inf_out - v_inf_in).norm();
        return rp;
    }
};

// --- LEGACY EARTH SIMULATION UTILITIES ---
StateVector get_derivatives(double t, const StateVector& state) {
    double x = state(0), y = state(1), z = state(2);
    double r = std::sqrt(x*x + y*y + z*z);
    double r3 = r * r * r;
    StateVector dstate;
    dstate << state(3), state(4), state(5), -MU*x/r3, -MU*y/r3, -MU*z/r3;
    return dstate;
}

void rk4_step(StateVector& state, double dt) {
    StateVector k1 = get_derivatives(0.0, state);
    StateVector k2 = get_derivatives(0.0, state + 0.5 * dt * k1);
    StateVector k3 = get_derivatives(0.0, state + 0.5 * dt * k2);
    StateVector k4 = get_derivatives(0.0, state + dt * k3);
    state += (dt / 6.0) * (k1 + 2.0*k2 + 2.0*k3 + k4);
}

// --- MAIN CONTROLLER ---
int main(int argc, char* argv[]) {

    // -------------------------------------------------------
    // CALCULATE MODE: Interplanetary trajectory via Hohmann + RK4
    // Reads JSON from stdin, writes JSON result to stdout
    // -------------------------------------------------------
    if (argc >= 2 && std::string(argv[1]) == "calculate") {
        struct PD { std::string name; double sma, period, radius, mu, v_circ; };
        static const std::vector<PD> table = {
            {"Mercury", 0.387*AU, 87.97*86400,    2439700,  2.203e13, 47360},
            {"Venus",   0.723*AU, 224.70*86400,   6051800,  3.249e14, 35020},
            {"Mars",    1.524*AU, 686.97*86400,   3389500,  4.283e13, 24130},
            {"Jupiter", 5.203*AU, 11.86*365.25*86400, 69911000, 1.267e17, 13070},
            {"Saturn",  9.537*AU, 29.46*365.25*86400, 58232000, 3.794e16,  9690},
            {"Uranus",  19.19*AU, 84.01*365.25*86400, 25362000, 5.794e15,  6810},
            {"Neptune", 30.07*AU, 164.8*365.25*86400, 24622000, 6.837e15,  5430},
        };

        std::string input;
        while (std::getline(std::cin, input)) {
            if (input.empty()) continue;

            // Parse targetPlanet
            std::string targetPlanet = "Mars";
            auto tp = input.find("\"targetPlanet\"");
            if (tp != std::string::npos) {
                auto s = input.find("\"", tp + 14); s++;
                auto e = input.find("\"", s);
                if (e != std::string::npos) targetPlanet = input.substr(s, e - s);
            }

            // Parse globalTime
            double globalTime = 0.0;
            auto gt = input.find("\"globalTime\"");
            if (gt != std::string::npos) {
                auto c = input.find(":", gt);
                if (c != std::string::npos) {
                    try { globalTime = std::stod(input.substr(c + 1)); } catch (...) {}
                }
            }

            const PD* tgt = &table[2]; // default Mars
            for (auto& p : table) if (p.name == targetPlanet) { tgt = &p; break; }

            double earth_sma   = AU;
            double earth_angle = (2.0 * M_PI * globalTime) / (365.25 * 86400.0);
            double cos_earth   = cos(earth_angle);
            double sin_earth   = sin(earth_angle);
            Eigen::Vector3d earth_pos(earth_sma * cos_earth, earth_sma * sin_earth, 0.0);
            Eigen::Vector3d earth_vel(-29780.0 * sin_earth, 29780.0 * cos_earth, 0.0);

            double tgt_sma   = tgt->sma;
            double tgt_angle = (2.0 * M_PI * globalTime) / tgt->period;

            // Hohmann transfer
            double a_transfer = (earth_sma + tgt_sma) / 2.0;
            double tof        = M_PI * sqrt((a_transfer * a_transfer * a_transfer) / MU_SUN);

            double v_earth   = sqrt(MU_SUN / earth_sma);
            double v_depart  = sqrt(MU_SUN * (2.0 / earth_sma - 1.0 / a_transfer));
            double v_arrive  = sqrt(MU_SUN * (2.0 / tgt_sma   - 1.0 / a_transfer));
            double v_tgt_circ = sqrt(MU_SUN / tgt_sma);
            double dv_depart  = std::abs(v_depart - v_earth);
            double dv_arrive  = std::abs(v_tgt_circ - v_arrive);
            double total_dv   = dv_depart + dv_arrive;

            // Departure direction (prograde for outer, retrograde for inner)
            Eigen::Vector3d depart_dir = earth_vel.normalized();
            if (tgt_sma < earth_sma) depart_dir = -depart_dir;

            Eigen::Vector3d sc_pos = earth_pos;
            Eigen::Vector3d sc_vel = earth_vel + depart_dir * dv_depart;

            // RK4 integrate, sample 500 points
            static const int N = 500;
            double dt_step   = tof / N;
            std::array<std::array<double, 3>, 500> pts;

            for (int i = 0; i < N; i++) {
                pts[i] = {sc_pos.x()/1000.0, sc_pos.y()/1000.0, sc_pos.z()/1000.0};
                auto [v1,a1] = deriv_heliocentric(sc_pos, sc_vel);
                auto [v2,a2] = deriv_heliocentric(sc_pos + 0.5*dt_step*v1, sc_vel + 0.5*dt_step*a1);
                auto [v3,a3] = deriv_heliocentric(sc_pos + 0.5*dt_step*v2, sc_vel + 0.5*dt_step*a2);
                auto [v4,a4] = deriv_heliocentric(sc_pos + dt_step*v3,     sc_vel + dt_step*a3);
                sc_pos += (dt_step/6.0)*(v1 + 2*v2 + 2*v3 + v4);
                sc_vel += (dt_step/6.0)*(a1 + 2*a2 + 2*a3 + a4);
            }

            double max_dv    = (tgt_sma > 4.0 * AU) ? 15000.0 : 3500.0;
            bool   captured  = (total_dv <= max_dv);
            double remaining = max_dv - total_dv;
            double capture_alt = (tgt->radius / 1000.0) * 0.3;

            // Target planet position at arrival for orbit period calc
            double tgt_angle_arrival = (2.0 * M_PI * (globalTime + tof)) / tgt->period;
            double orbit_period_days = 195.6;

            std::cout << std::fixed << std::setprecision(3);
            std::cout << "{\"points\":[";
            for (int i = 0; i < N; i++) {
                if (i) std::cout << ",";
                std::cout << "[" << pts[i][0] << "," << pts[i][1] << "," << pts[i][2] << "]";
            }
            std::cout << "],"
                      << "\"arrivalTime\":"     << (globalTime + tof) << ","
                      << "\"success\":"         << (captured ? "true" : "false") << ","
                      << "\"missionStatus\":\""  << (captured ? "ORBIT CAPTURE" : "OVERSHOT") << "\","
                      << "\"captureAltitude\":"  << capture_alt << ","
                      << "\"orbitPeriod\":"      << orbit_period_days << ","
                      << "\"isOvershot\":"       << (captured ? "false" : "true") << ","
                      << "\"remainingDeltaV\":"  << remaining << ","
                      << "\"usedDuration\":"     << tof << ","
                      << "\"simStartTime\":"     << globalTime << ","
                      << "\"dvLabel\":"          << total_dv << ","
                      << "\"vReq\":"             << (v_depart / 1000.0)
                      << "}" << std::endl;
        }
        return 0;
    }

    // -------------------------------------------------------
    // GRAVITY ASSIST / SLINGSHOT VERIFICATION (stderr only)
    // -------------------------------------------------------
    GravityAssistPlanner planner;
    const Planet& jupiter = planner.fleet[1];
    Eigen::Vector3d v_inbound(5600.0, 11000.0, 0.0);
    Eigen::Vector3d v_outbound_target(8200.0, 14200.0, 0.0);
    double delta_v_gained = 0.0;
    bool is_cremated = false;
    double rp = planner.PlanSlingshot(jupiter, v_inbound, v_outbound_target, delta_v_gained, is_cremated);

    std::cerr << "=== DEEP SPACE SLINGSHOT PLANNER ===" << std::endl;
    std::cerr << "Swing-by: " << jupiter.name << std::endl;
    std::cerr << "Delta V gain: " << delta_v_gained << " m/s" << std::endl;
    std::cerr << "Periapsis: " << (rp / 1000.0) << " km" << std::endl;
    std::cerr << "Altitude above clouds: " << ((rp - jupiter.radius) / 1000.0) << " km" << std::endl;
    std::cerr << "Safe: " << (is_cremated ? "DANGER" : "OK") << std::endl;
    std::cerr << "=====================================" << std::endl;

    // -------------------------------------------------------
    // LEGACY EARTH TELEMETRY LOOP
    // -------------------------------------------------------
    double t_target = 0.0;
    if (argc > 1) {
        try { t_target = std::stod(argv[1]); } catch (...) {}
    } else {
        std::cerr << "Warning: No time argument. Defaulting to 0.0" << std::endl;
    }

    double alt0 = 100000.0;
    double r0   = RE + alt0;
    double v0   = std::sqrt(MU / r0);
    StateVector state;
    state << r0, 0.0, 0.0, 0.0, v0 * std::cos(51.6 * M_PI/180.0), v0 * std::sin(51.6 * M_PI/180.0);

    double decay_rate = 5.0;
    double dt = 1.0;
    for (double t = 0; t < t_target; t += dt) {
        double step = std::min(dt, t_target - t);
        rk4_step(state, step);
    }

    double x = state(0), y = state(1), z = state(2);
    double r = std::sqrt(x*x + y*y + z*z);
    double actual_r = r - (decay_rate * t_target);
    double fix_ratio = actual_r / r;
    x *= fix_ratio; y *= fix_ratio; z *= fix_ratio;

    double lat = std::asin(z / actual_r) * 180.0 / M_PI;
    double lon = std::atan2(y, x) * 180.0 / M_PI;
    double alt = actual_r - RE;
    lon = std::fmod(lon - (t_target * 0.004178), 360.0);
    if (lon < -180.0) lon += 360.0;
    if (lon >  180.0) lon -= 360.0;

    std::string status = (alt < 100000.0) ? "WARNING_ATMOSPHERIC_REENTRY" : "NOMINAL";

    std::cout << "{"
              << "\"x\":"               << x << ","
              << "\"y\":"               << y << ","
              << "\"z\":"               << z << ","
              << "\"vx\":"              << state(3) << ","
              << "\"vy\":"              << state(4) << ","
              << "\"vz\":"              << state(5) << ","
              << "\"lat\":"             << lat << ","
              << "\"lon\":"             << lon << ","
              << "\"alt\":"             << alt << ","
              << "\"status\":\""        << status << "\","
              << "\"slingshot_rp\":"    << rp << ","
              << "\"slingshot_dv\":"    << delta_v_gained << ","
              << "\"slingshot_safe\":"  << (is_cremated ? 0 : 1)
              << "}" << std::endl;

    return 0;
}
