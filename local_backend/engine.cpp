#include <iostream>
#include <string>
#include <cmath>
#include <vector>
#include <array>
#include <iomanip>
#include <memory>
#include <algorithm>
#include <Eigen/Dense>
#include "GuidanceComputer.hpp"

// --- PHYSICAL CONSTANTS ---
const double G = 6.67430e-11;
const double MU_SUN = 1.32712440018e20;
const double AU = 1.495978707e11;

inline std::pair<Eigen::Vector3d, Eigen::Vector3d> deriv_heliocentric(const Eigen::Vector3d& p, const Eigen::Vector3d& v) {
    double r = p.norm();
    double r3 = r * r * r;
    return std::pair<Eigen::Vector3d, Eigen::Vector3d>(v, -MU_SUN * p / r3);
}

// Preview Mode & Slingshot Helper Constants to prevent collision
const double MU_SUN_N = 132712440018.0;
const double MU_MOON = 4902.8;
const double MU_JUPITER = 126686534.0;
const double PREVIEW_RE = 6378.137;
const double PREVIEW_MU_EARTH = 398600.4418;
const double PREVIEW_J2 = 1.08262668e-3;

// Atmospheric Drag Constants
const double RHO0 = 2e-12; 
const double H0 = 150.0;   
const double SH = 8.5;     
const double CD = 2.2;     
const double AM = 0.01;    

typedef Eigen::Matrix<double, 6, 1> State;

struct PropBody {
    std::string name;
    double mu;
    Eigen::Vector3d pos;
};

inline Eigen::Vector3d get_earth_helio_pos(double t) {
    double omega = 2.0 * M_PI / (365.25 * 86400.0);
    double r = AU / 1000.0; // km
    return Eigen::Vector3d(r * cos(omega * t), r * sin(omega * t), 0);
}

inline Eigen::Vector3d get_jupiter_helio_pos(double t) {
    double omega = 2.0 * M_PI / (11.86 * 365.25 * 86400.0);
    double r = 5.203 * AU / 1000.0; // km
    return Eigen::Vector3d(r * cos(omega * t), r * sin(omega * t), 0);
}

inline Eigen::Vector3d get_moon_geo_pos(double t) {
    double omega = 2.0 * M_PI / (27.32 * 86400.0);
    double r = 384400.0; // km
    return Eigen::Vector3d(r * cos(omega * t), r * sin(omega * t), r * 0.087 * sin(omega * t));
}

inline State get_derivatives_prop(const State& state, double t, bool nbody_enabled) {
    Eigen::Vector3d r_vec = state.segment<3>(0);
    Eigen::Vector3d v_vec = state.segment<3>(3);
    double r = r_vec.norm();
    double r3 = r * r * r;

    // 1. Two-body Gravity
    Eigen::Vector3d acc = -PREVIEW_MU_EARTH / r3 * r_vec;

    // 2. J2 Perturbation
    double z = r_vec(2);
    double r2 = r * r;
    double j2_const = 1.5 * PREVIEW_J2 * PREVIEW_MU_EARTH * pow(PREVIEW_RE, 2) / pow(r, 5);
    
    acc(0) += j2_const * r_vec(0) * (5.0 * pow(z, 2) / r2 - 1.0);
    acc(1) += j2_const * r_vec(1) * (5.0 * pow(z, 2) / r2 - 1.0);
    acc(2) += j2_const * r_vec(2) * (5.0 * pow(z, 2) / r2 - 3.0);

    // 3. N-Body Perturbations
    if (nbody_enabled) {
        Eigen::Vector3d earth_helio = get_earth_helio_pos(t);
        std::vector<PropBody> bodies = {
            {"Sun", MU_SUN_N, -earth_helio}, // Sun relative to Earth
            {"Moon", MU_MOON, get_moon_geo_pos(t)},
            {"Jupiter", MU_JUPITER, get_jupiter_helio_pos(t) - earth_helio} // Jupiter relative to Earth
        };

        for (const auto& body : bodies) {
            Eigen::Vector3d r_body_sat = body.pos - r_vec;
            Eigen::Vector3d r_body_earth = body.pos;
            double r_bs3 = pow(r_body_sat.norm(), 3);
            double r_be3 = pow(r_body_earth.norm(), 3);
            acc += body.mu * (r_body_sat / r_bs3 - r_body_earth / r_be3);
        }
    }

    // 4. Atmospheric Drag (< 200km)
    double altitude = r - PREVIEW_RE;
    if (altitude < 200.0 && altitude > 0) {
        // Pure SI units to prevent unit mixing
        double h_meters = altitude * 1000.0;
        double rho = RHO0 * exp(-(h_meters) / (SH * 1000.0)); // SH in km to meters
        double v_rel_ms = v_vec.norm() * 1000.0;
        Eigen::Vector3d v_vec_ms = v_vec * 1000.0;
        
        Eigen::Vector3d acc_drag_ms2 = -0.5 * CD * AM * rho * v_rel_ms * v_vec_ms;
        acc += acc_drag_ms2 / 1000.0; // Convert m/s^2 back to km/s^2
    }

    State dstate;
    dstate.segment<3>(0) = v_vec;
    dstate.segment<3>(3) = acc;
    return dstate;
}

inline void step_rk4_prop(State& state, double& t, double dt, bool nbody_enabled) {
    State k1 = get_derivatives_prop(state, t, nbody_enabled);
    State k2 = get_derivatives_prop(state + 0.5 * dt * k1, t + 0.5 * dt, nbody_enabled);
    State k3 = get_derivatives_prop(state + 0.5 * dt * k2, t + 0.5 * dt, nbody_enabled);
    State k4 = get_derivatives_prop(state + dt * k3, t + dt, nbody_enabled);
    state += (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4);
    t += dt;
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
void IntegratePhysics(Spacecraft& probe, std::vector<Planet>& planets, double max_dt) {
    const double alpha = 0.01;
    double t_accumulated = 0.0;

    while (t_accumulated < max_dt) {
        double min_dist = INFINITY;
        Planet* nearest_planet = nullptr;
        for (auto& planet : planets) {
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

        // Update planetary positions simply linearly during this timestep
        for (auto& planet : planets) {
            double r_sun = planet.pos.norm();
            Eigen::Vector3d a_planet = -MU_SUN * planet.pos / (r_sun * r_sun * r_sun);
            planet.pos += planet.vel * dt_adaptive;
            planet.vel += a_planet * dt_adaptive; 
        }

        if (nearest_planet) {
            ExecuteCaptureBurn(probe, *nearest_planet);
        }

        t_accumulated += dt_adaptive;
    }
}

// --- MULTI-BODY SYSTEM INITIALIZATION ---
std::vector<Planet> InitializeSolarSystem(double current_time = 0.0) {
    std::vector<Planet> planets;

    struct KeplerianElements {
        std::string name;
        double a; double e; double i; double Omega; double w; double M0; double period; double radius; double mu;
    };
    std::vector<KeplerianElements> table = {
        {"Earth",   1.000 * AU, 0.0167, 0.0, -11.26 * M_PI/180.0, 114.2 * M_PI/180.0, 358.0 * M_PI/180.0, 365.25 * 86400, 6371000.0, 3.986e14},
        {"Jupiter", 5.204 * AU, 0.0489, 1.3 * M_PI/180.0, 100.4 * M_PI/180.0, 273.8 * M_PI/180.0, 20.0 * M_PI/180.0, 4332.59 * 86400, 69911000.0, 1.267e17},
        {"Saturn",  9.582 * AU, 0.0565, 2.48 * M_PI/180.0, 113.6 * M_PI/180.0, 339.3 * M_PI/180.0, 317.0 * M_PI/180.0, 10759.0 * 86400, 58232000.0, 3.793e16},
        {"Uranus",  19.201 * AU, 0.0457, 0.77 * M_PI/180.0, 74.0 * M_PI/180.0, 96.6 * M_PI/180.0, 142.0 * M_PI/180.0, 30688.0 * 86400, 25362000.0, 5.794e15},
        {"Neptune", 30.047 * AU, 0.0113, 1.77 * M_PI/180.0, 131.7 * M_PI/180.0, 273.1 * M_PI/180.0, 256.0 * M_PI/180.0, 60182.0 * 86400, 24622000.0, 6.837e15},
    };

    auto propagate_orbit = [](const KeplerianElements& el, double t) -> std::pair<Eigen::Vector3d, Eigen::Vector3d> {
        double n = (2.0 * M_PI) / el.period;
        double M = std::fmod(el.M0 + n * t, 2.0 * M_PI);
        double E = M;
        for (int i=0; i<100; ++i) {
            double num = E - el.e * std::sin(E) - M;
            double den = 1.0 - el.e * std::cos(E);
            if (std::abs(num/den) < 1e-6) break;
            E -= num/den;
        }
        
        double nu = 2.0 * std::atan2(std::sqrt(1.0 + el.e) * std::sin(E / 2.0), std::sqrt(1.0 - el.e) * std::cos(E / 2.0));
        double r = el.a * (1.0 - el.e * std::cos(E));
        
        double x_orbit = r * std::cos(nu);
        double y_orbit = r * std::sin(nu);
        
        double cw = std::cos(el.w), sw = std::sin(el.w);
        double c_Omega = std::cos(el.Omega), s_Omega = std::sin(el.Omega);
        double ci = std::cos(el.i), si = std::sin(el.i);
        
        double x = x_orbit * (cw * c_Omega - sw * ci * s_Omega) - y_orbit * (sw * c_Omega + cw * ci * s_Omega);
        double y = x_orbit * (cw * s_Omega + sw * ci * c_Omega) - y_orbit * (sw * s_Omega - cw * ci * c_Omega);
        double z = x_orbit * (sw * si) + y_orbit * (cw * si);

        double dt = 1.0;
        double M_dt = std::fmod(el.M0 + n * (t + dt), 2.0 * M_PI);
        double E_dt = M_dt;
        for (int i=0; i<100; ++i) {
            double num = E_dt - el.e * std::sin(E_dt) - M_dt;
            if (std::abs(num/(1.0 - el.e * std::cos(E_dt))) < 1e-6) break;
            E_dt -= num/(1.0 - el.e * std::cos(E_dt));
        }
        double nu_dt = 2.0 * std::atan2(std::sqrt(1.0 + el.e) * std::sin(E_dt / 2.0), std::sqrt(1.0 - el.e) * std::cos(E_dt / 2.0));
        double r_dt = el.a * (1.0 - el.e * std::cos(E_dt));
        double xo_dt = r_dt * std::cos(nu_dt), yo_dt = r_dt * std::sin(nu_dt);

        double x_dt = xo_dt * (cw * c_Omega - sw * ci * s_Omega) - yo_dt * (sw * c_Omega + cw * ci * s_Omega);
        double y_dt = xo_dt * (cw * s_Omega + sw * ci * c_Omega) - yo_dt * (sw * s_Omega - cw * ci * c_Omega);
        double z_dt = xo_dt * (sw * si) + yo_dt * (cw * si);

        return {Eigen::Vector3d(x, y, z), Eigen::Vector3d(x_dt - x, y_dt - y, z_dt - z)};
    };

    for (const auto& el : table) {
        auto [pos, vel] = propagate_orbit(el, current_time);
        planets.push_back({
            el.name, el.mu / G, el.radius, 500000.0, el.mu, el.a, el.period, pos, vel
        });
    }

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
    // PREVIEW MODE: Orbital preview & Guidance Computer
    // -------------------------------------------------------
    if (argc >= 10 && std::string(argv[1]) == "preview") {
        State state;
        bool nbody_enabled = true;

        double vx = std::stod(argv[2]);
        double vy = std::stod(argv[3]);
        double vz = std::stod(argv[4]);
        nbody_enabled = std::stoi(argv[5]) == 1;
        
        double start_lat = std::stod(argv[6]);
        double start_lon = std::stod(argv[7]);
        double target_lat = std::stod(argv[8]);
        double target_lon = std::stod(argv[9]);
        
        double lat_rad = start_lat * M_PI / 180.0;
        double lon_rad = start_lon * M_PI / 180.0;
        // Start 400km above surface
        double rx = (PREVIEW_RE + 400.0) * cos(lat_rad) * cos(lon_rad);
        double ry = (PREVIEW_RE + 400.0) * cos(lat_rad) * sin(lon_rad);
        double rz = (PREVIEW_RE + 400.0) * sin(lat_rad);
        
        state << rx, ry, rz,
                 vx, vy, vz;

        // If a target is provided (not both 0), run the landing path predictor
        if (target_lat != 0.0 || target_lon != 0.0) {
            GuidanceComputer gc(PREVIEW_MU_EARTH, PREVIEW_RE, 150.0, 2e-12, 8.5, 2.2, 0.01);
            double earth_rotation_rate = 7.2921159e-5; // rad/s
            std::vector<Eigen::Vector3d> path = gc.find_landing_trajectory(
                Eigen::Vector3d(rx, ry, rz), 
                Eigen::Vector3d::Zero(), 
                target_lat, 
                target_lon, 
                earth_rotation_rate
            );
            
            std::cout << "[";
            int step = std::max(1, (int)path.size() / 500); // limit to max 500 steps
            bool first = true;
            for (size_t i = 0; i < path.size(); i += step) {
                if (!first) std::cout << ",";
                std::cout << "[" << path[i].x() << "," << path[i].y() << "," << path[i].z() << "]";
                first = false;
            }
            if (path.size() > 0 && (path.size() - 1) % step != 0) {
                const auto& last = path.back();
                std::cout << ",[" << last.x() << "," << last.y() << "," << last.z() << "]";
            }
            std::cout << "]" << std::endl;
            return 0;
        }

        double t = 0.0;
        double dt = 100.0;
        std::cout << "[";
        for (int i = 0; i < 8640; ++i) { // 10 days at 100s steps
            step_rk4_prop(state, t, dt, nbody_enabled);
            std::cout << "[" << state(0) << "," << state(1) << "," << state(2) << "]";
            if (i < 8639) std::cout << ",";
        }
        std::cout << "]" << std::endl;
        return 0;
    }

    // -------------------------------------------------------
    // CALCULATE MODE: Interplanetary trajectory via Lambert + N-Body
    // Reads JSON from stdin, writes JSON result to stdout
    // -------------------------------------------------------
    if (argc >= 2 && std::string(argv[1]) == "calculate") {
        struct KeplerianElements {
            std::string name;
            double a; // semi-major axis (meters)
            double e; // eccentricity
            double i; // inclination (rad)
            double Omega; // longitude of ascending node (rad)
            double w; // argument of periapsis (rad)
            double M0; // mean anomaly at epoch (rad)
            double period; // orbital period (seconds)
            double radius; // planet radius (meters)
            double mu; // gravitational parameter (m^3/s^2)
        };

        static const std::vector<KeplerianElements> table = {
            {"Mercury", 0.387 * AU, 0.2056, 7.0 * M_PI/180.0, 48.33 * M_PI/180.0, 29.124 * M_PI/180.0, 174.0 * M_PI/180.0, 88.0 * 86400, 2439000.0, 2.203e13},
            {"Venus",   0.723 * AU, 0.0067, 3.39 * M_PI/180.0, 76.68 * M_PI/180.0, 54.88 * M_PI/180.0, 50.0 * M_PI/180.0, 224.7 * 86400, 6051000.0, 3.249e14},
            {"Earth",   1.000 * AU, 0.0167, 0.00005 * M_PI/180.0, -11.26 * M_PI/180.0, 114.2 * M_PI/180.0, 358.0 * M_PI/180.0, 365.25 * 86400, 6371000.0, 3.986e14},
            {"Mars",    1.524 * AU, 0.0934, 1.85 * M_PI/180.0, 49.57 * M_PI/180.0, 286.5 * M_PI/180.0, 19.0 * M_PI/180.0, 686.98 * 86400, 3389000.0, 4.283e13},
            {"Jupiter", 5.204 * AU, 0.0489, 1.3 * M_PI/180.0, 100.4 * M_PI/180.0, 273.8 * M_PI/180.0, 20.0 * M_PI/180.0, 4332.59 * 86400, 69911000.0, 1.267e17},
            {"Saturn",  9.582 * AU, 0.0565, 2.48 * M_PI/180.0, 113.6 * M_PI/180.0, 339.3 * M_PI/180.0, 317.0 * M_PI/180.0, 10759.0 * 86400, 58232000.0, 3.793e16},
            {"Uranus",  19.201 * AU, 0.0457, 0.77 * M_PI/180.0, 74.0 * M_PI/180.0, 96.6 * M_PI/180.0, 142.0 * M_PI/180.0, 30688.0 * 86400, 25362000.0, 5.794e15},
            {"Neptune", 30.047 * AU, 0.0113, 1.77 * M_PI/180.0, 131.7 * M_PI/180.0, 273.1 * M_PI/180.0, 256.0 * M_PI/180.0, 60182.0 * 86400, 24622000.0, 6.837e15},
        };

        auto solve_kepler = [](double M, double e, double tol=1e-6) -> double {
            double E = M;
            double delta = 1.0;
            int max_iter = 100;
            while (std::abs(delta) > tol && max_iter > 0) {
                delta = (E - e * std::sin(E) - M) / (1.0 - e * std::cos(E));
                E -= delta;
                max_iter--;
            }
            return E;
        };

        auto propagate_orbit = [&](const KeplerianElements& el, double time_since_epoch) -> Eigen::Vector3d {
            double n = (2.0 * M_PI) / el.period;
            double M = std::fmod(el.M0 + n * time_since_epoch, 2.0 * M_PI);
            double E = solve_kepler(M, el.e);
            
            double nu = 2.0 * std::atan2(std::sqrt(1.0 + el.e) * std::sin(E / 2.0),
                                         std::sqrt(1.0 - el.e) * std::cos(E / 2.0));
            double r = el.a * (1.0 - el.e * std::cos(E));
            
            double x_orbit = r * std::cos(nu);
            double y_orbit = r * std::sin(nu);
            
            double cw = std::cos(el.w);
            double sw = std::sin(el.w);
            double c_Omega = std::cos(el.Omega);
            double s_Omega = std::sin(el.Omega);
            double ci = std::cos(el.i);
            double si = std::sin(el.i);
            
            double x = x_orbit * (cw * c_Omega - sw * ci * s_Omega) - y_orbit * (sw * c_Omega + cw * ci * s_Omega);
            double y = x_orbit * (cw * s_Omega + sw * ci * c_Omega) - y_orbit * (sw * s_Omega - cw * ci * c_Omega);
            double z = x_orbit * (sw * si) + y_orbit * (cw * si);
            
            return Eigen::Vector3d(x, y, z);
        };

        auto get_orbital_velocity = [&](const KeplerianElements& el, double time_since_epoch) -> Eigen::Vector3d {
            double dt = 1.0;
            Eigen::Vector3d p1 = propagate_orbit(el, time_since_epoch - dt/2.0);
            Eigen::Vector3d p2 = propagate_orbit(el, time_since_epoch + dt/2.0);
            return (p2 - p1) / dt;
        };

        std::string input;
        while (std::getline(std::cin, input)) {
            if (input.empty()) continue;

            std::string launchPlanet = "Earth";
            auto lp = input.find("\"launchPlanet\"");
            if (lp != std::string::npos) {
                auto s = input.find("\"", lp + 14); s++;
                auto e = input.find("\"", s);
                if (e != std::string::npos) launchPlanet = input.substr(s, e - s);
            }

            std::string targetPlanet = "Mars";
            auto tp = input.find("\"targetPlanet\"");
            if (tp != std::string::npos) {
                auto s = input.find("\"", tp + 14); s++;
                auto e = input.find("\"", s);
                if (e != std::string::npos) targetPlanet = input.substr(s, e - s);
            }

            double globalTime = 0.0;
            auto gt = input.find("\"globalTime\"");
            if (gt != std::string::npos) {
                auto c = input.find(":", gt);
                if (c != std::string::npos) {
                    try { globalTime = std::stod(input.substr(c + 1)); } catch (...) {}
                }
            }

            const KeplerianElements* earth = &table[2]; // Default Earth
            for (auto& p : table) if (p.name == launchPlanet) { earth = &p; break; }

            const KeplerianElements* tgt = &table[3]; // Default Mars
            for (auto& p : table) if (p.name == targetPlanet) { tgt = &p; break; }

            Eigen::Vector3d earth_pos = propagate_orbit(*earth, globalTime);
            Eigen::Vector3d earth_vel = get_orbital_velocity(*earth, globalTime);

            // Coarse parameter approximation for Lambert
            double a_transfer = (earth->a + tgt->a) / 2.0;
            double hohmann_tof = M_PI * std::sqrt((a_transfer * a_transfer * a_transfer) / MU_SUN);
            
            // Refined Lambert target search
            GuidanceComputer gc(MU_SUN, 0, 0, 0, 0, 0, 0); // Temporary GC just for Lambert
            
            double best_tof = hohmann_tof;
            double min_dv = std::numeric_limits<double>::infinity();
            Eigen::Vector3d best_v = Eigen::Vector3d::Zero();
            
            double d_min = std::max(10.0, (hohmann_tof / 86400.0) * 0.2);
            double d_max = std::max(100.0, (hohmann_tof / 86400.0) * 2.5);
            
            for (double d = d_min; d <= d_max; d += 5.0) {
                double tof_seconds = d * 86400.0;
                Eigen::Vector3d tgt_pos = propagate_orbit(*tgt, globalTime + tof_seconds);
                try {
                    Eigen::Vector3d v_lambert = gc.solve_lambert(earth_pos, tgt_pos, tof_seconds, MU_SUN);
                    double dv = (v_lambert - earth_vel).norm();
                    if (dv < min_dv) {
                        min_dv = dv;
                        best_tof = tof_seconds;
                        best_v = v_lambert;
                    }
                } catch (...) {}
            }

            double dv_depart = min_dv;
            Eigen::Vector3d v_arrive = gc.solve_lambert(propagate_orbit(*tgt, globalTime + best_tof), earth_pos, -best_tof, MU_SUN); // Velocity at arrival
            // Arrival dv approximation (difference from target velocity)
            Eigen::Vector3d tgt_vel = get_orbital_velocity(*tgt, globalTime + best_tof);
            double dv_arrive = (v_arrive - tgt_vel).norm();
            
            double total_dv = dv_depart + dv_arrive;

            Spacecraft probe;
            probe.pos = earth_pos;
            probe.vel = best_v;
            probe.current_delta_v_pool = (tgt->a > 4.0 * AU) ? 15000.0 : 3500.0;
            
            Planet target_body = {
                tgt->name, 
                tgt->mu / G, 
                tgt->radius, 
                200000.0, 
                tgt->mu, 
                tgt->a, 
                tgt->period,
                propagate_orbit(*tgt, globalTime + best_tof),
                tgt_vel
            };
            std::vector<Planet> sys_planets = { target_body };

            IntegratePhysics(probe, sys_planets, best_tof);

            static const int N = 500;
            std::vector<Eigen::Vector3d> ghost_path = gc.generate_ghost_path(earth_pos, best_v, best_tof, MU_SUN, N);
            
            bool captured = probe.is_captured;
            double remaining = probe.current_delta_v_pool;
            double capture_alt = 0.0;
            double orbit_period_days = 0.0;

            if (captured) {
                // Post-capture analysis
                Eigen::Vector3d r_rel = probe.pos - target_body.pos;
                Eigen::Vector3d v_rel = probe.vel - target_body.vel;
                double h = r_rel.cross(v_rel).norm();
                double energy = (v_rel.norm() * v_rel.norm()) / 2.0 - tgt->mu / r_rel.norm();
                double a_final = -tgt->mu / (2.0 * energy);
                double e_final = std::sqrt(1.0 + (2.0 * energy * h * h) / (tgt->mu * tgt->mu));
                double rp = a_final * (1.0 - e_final);
                capture_alt = (rp - tgt->radius) / 1000.0;
                orbit_period_days = (2.0 * M_PI * std::sqrt(pow(a_final, 3) / tgt->mu)) / 86400.0;
            } else {
                capture_alt = (probe.pos - target_body.pos).norm() / 1000.0; 
                orbit_period_days = -1.0;
            }

            std::cout << std::fixed << std::setprecision(3);
            std::cout << "{\"points\":[";
            for (int i = 0; i < N; i++) {
                if (i) std::cout << ",";
                std::cout << "[" << ghost_path[i].x()/1000.0 << "," << ghost_path[i].y()/1000.0 << "," << ghost_path[i].z()/1000.0 << "]";
            }
            std::cout << "],"
                      << "\"arrivalTime\":"     << (globalTime + best_tof) << ","
                      << "\"success\":"         << (captured ? "true" : "false") << ","
                      << "\"missionStatus\":\""  << (captured ? "ORBIT CAPTURE" : "OVERSHOT") << "\","
                      << "\"captureAltitude\":"  << capture_alt << ","
                      << "\"orbitPeriod\":"      << std::abs(orbit_period_days) << ","
                      << "\"isOvershot\":"       << (captured ? "false" : "true") << ","
                      << "\"remainingDeltaV\":"  << remaining << ","
                      << "\"usedDuration\":"     << best_tof << ","
                      << "\"simStartTime\":"     << globalTime << ","
                      << "\"dvLabel\":"          << total_dv << ","
                      << "\"vReq\":"             << (best_v.norm() / 1000.0)
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

    State state;
    bool nbody_enabled = false;
    // Usage: odyssey_engine <time> <x> <y> <z> <vx> <vy> <vz> <nbody>
    if (argc >= 9) {
        state << std::stod(argv[2]), std::stod(argv[3]), std::stod(argv[4]),
                 std::stod(argv[5]), std::stod(argv[6]), std::stod(argv[7]);
        nbody_enabled = std::stoi(argv[8]) == 1;
    } else {
        // Fallback ISS orbit in km
        double alt0 = 400.0;
        double r0   = PREVIEW_RE + alt0;
        double v0   = std::sqrt(PREVIEW_MU_EARTH / r0);
        state << r0, 0.0, 0.0, 
                 0.0, v0 * std::cos(51.6 * M_PI/180.0), v0 * std::sin(51.6 * M_PI/180.0);
    }

    double dt = 10.0; // Adaptive fallback basic step for standard simulation
    double t = 0;
    while (t < t_target) {
        double step = std::min(dt, t_target - t);
        step_rk4_prop(state, t, step, nbody_enabled);
        
        double current_r = state.segment<3>(0).norm();
        if (current_r <= PREVIEW_RE) {
            // Reentry detected
            break;
        }
    }

    double x = state(0) * 1000.0, y = state(1) * 1000.0, z = state(2) * 1000.0; // Output in meters for legacy reasons
    double actual_r = std::sqrt(x*x + y*y + z*z);

    double lat = std::asin(z / actual_r) * 180.0 / M_PI;
    double lon = std::atan2(y, x) * 180.0 / M_PI;
    double alt_meters = actual_r - (PREVIEW_RE * 1000.0);
    
    // Earth rotation correction for longitude
    lon = std::fmod(lon - (t * 7.2921159e-5 * 180.0 / M_PI), 360.0);
    if (lon < -180.0) lon += 360.0;
    if (lon >  180.0) lon -= 360.0;

    std::string status = (alt_meters <= 0.0) ? "TERMINATED_REENTRY" : ((alt_meters < 100000.0) ? "WARNING_ATMOSPHERIC_REENTRY" : "NOMINAL");

    std::cout << "{"
              << "\"x\":"               << x << ","
              << "\"y\":"               << y << ","
              << "\"z\":"               << z << ","
              << "\"vx\":"              << state(3) * 1000.0 << ","
              << "\"vy\":"              << state(4) * 1000.0 << ","
              << "\"vz\":"              << state(5) * 1000.0 << ","
              << "\"lat\":"             << lat << ","
              << "\"lon\":"             << lon << ","
              << "\"alt\":"             << alt_meters << ","
              << "\"status\":\""        << status << "\","
              << "\"slingshot_rp\":"    << rp << ","
              << "\"slingshot_dv\":"    << delta_v_gained << ","
              << "\"slingshot_safe\":"  << (is_cremated ? 0 : 1)
              << "}" << std::endl;

    return 0;
}
