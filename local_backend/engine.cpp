#include <iostream>
#include <string>
#include <cmath>
#include <vector>
#include <iomanip>
#include <memory>
#include <algorithm>
#include <Eigen/Dense>

// --- Constants ---
const double G = 6.67430e-11;
const double MU_SUN = 1.32712440018e20;
const double AU = 1.495978707e11;
const double MU = 3.986004418e14;
const double RE = 6371000.0;

typedef Eigen::Matrix<double, 6, 1> StateVector;

// --- Structs ---
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

struct Spacecraft {
    Eigen::Vector3d pos = Eigen::Vector3d::Zero();
    Eigen::Vector3d vel = Eigen::Vector3d::Zero();
    double mass = 1000.0;
    double current_delta_v_pool = 3500.0;
    bool is_captured = false;
    bool is_overshot = false;
};

struct KeplerEl {
    std::string name;
    double a, e, inc, Omega, w, M0, period;
    double radius_m, mu;
};

// --- Core Physics Functions ---
void ExecuteCaptureBurn(Spacecraft& probe, const Planet& target_planet) {
    if (probe.is_captured || probe.is_overshot) return;
    
    Eigen::Vector3d r_rel = probe.pos - target_planet.pos;
    Eigen::Vector3d v_rel = probe.vel - target_planet.vel;
    double r_mag = r_rel.norm();
    double v_mag = v_rel.norm();
    double M_SUN = 1.989e30; // Solar mass
    double soi = target_planet.semi_major_axis * std::pow(target_planet.mass / M_SUN, 0.4);
    
    if (r_mag > soi) return;
    
    double mu = target_planet.mu;
    Eigen::Vector3d h_vec = r_rel.cross(v_rel);
    double h = h_vec.norm();
    double energy = (v_mag * v_mag) / 2.0 - mu / r_mag;
    
    if (energy <= 0.0) { 
        probe.is_captured = true; 
        return; 
    }
    
    double a_hyper = -mu / (2.0 * energy);
    double e = std::sqrt(1.0 + (2.0 * energy * h * h) / (mu * mu));
    double rp = a_hyper * (1.0 - e); // For hyperbola, r = a(1-e) where a is negative, e > 1, so rp is positive
    
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

std::vector<Planet> InitializeSolarSystem() {
    std::vector<Planet> planets;
    planets.push_back({"Earth",   5.9722e24, 6371000.0,  120000.0, G*5.9722e24, 1.00*AU, 365.25*86400.0,       Eigen::Vector3d(1.00*AU,0,0), Eigen::Vector3d(0,29780,0)});
    planets.push_back({"Jupiter", 1.8982e27, 69911000.0,1000000.0, G*1.8982e27, 5.20*AU, 11.86*365.25*86400.0, Eigen::Vector3d(5.20*AU,0,0), Eigen::Vector3d(0,13070,0)});
    planets.push_back({"Saturn",  5.6834e26, 58232000.0,1000000.0, G*5.6834e26, 9.58*AU, 29.45*365.25*86400.0, Eigen::Vector3d(9.58*AU,0,0), Eigen::Vector3d(0,9690,0)});
    planets.push_back({"Uranus",  8.6810e25, 25362000.0, 500000.0, G*8.6810e25, 19.22*AU, 84.01*365.25*86400.0,Eigen::Vector3d(19.22*AU,0,0), Eigen::Vector3d(0,6810,0)});
    planets.push_back({"Neptune", 1.0241e26, 24622000.0, 500000.0, G*1.0241e26, 30.05*AU, 164.79*365.25*86400.0,Eigen::Vector3d(30.05*AU,0,0), Eigen::Vector3d(0,5430,0)});
    return planets;
}

class GravityAssistPlanner {
public:
    std::vector<Planet> fleet;
    GravityAssistPlanner() { fleet = InitializeSolarSystem(); }

    double PlanSlingshot(const Planet& swingby_body, const Eigen::Vector3d& v_sc_in, const Eigen::Vector3d& v_target_out, double& actual_delta_v, bool& atmospheric_impact) {
        Eigen::Vector3d v_inf_in = v_sc_in - swingby_body.vel;
        double v_inf = v_inf_in.norm();
        Eigen::Vector3d v_inf_out = (v_target_out - swingby_body.vel).normalized() * v_inf;
        
        double cos_theta = v_inf_in.dot(v_inf_out) / (v_inf * v_inf);
        cos_theta = std::max(-1.0, std::min(1.0, cos_theta));
        double theta = std::acos(cos_theta);
        double sin_half_theta = std::sin(theta / 2.0);
        
        double rp = sin_half_theta > 0.0 ? (swingby_body.mu / (v_inf * v_inf)) * ((1.0 / sin_half_theta) - 1.0) : swingby_body.radius;
        atmospheric_impact = (rp < swingby_body.radius + swingby_body.atmosphere_limit);
        Eigen::Vector3d heliocentric_before = v_inf_in + swingby_body.vel;
        Eigen::Vector3d heliocentric_after  = v_inf_out + swingby_body.vel;

        actual_delta_v = heliocentric_after.norm() - heliocentric_before.norm();
        return rp;
    }
};

StateVector get_derivatives(double t, const StateVector& state) {
    double x = state(0), y = state(1), z = state(2);
    double r = std::sqrt(x*x + y*y + z*z);
    double r3 = r * r * r;
    StateVector dstate;
    dstate << state(3), state(4), state(5), -MU*x/r3, -MU*y/r3, -MU*z/r3;
    return dstate;
}

void rk4_step(StateVector& state, double dt) {
    StateVector k1 = get_derivatives(0, state);
    StateVector k2 = get_derivatives(0, state + 0.5 * dt * k1);
    StateVector k3 = get_derivatives(0, state + 0.5 * dt * k2);
    StateVector k4 = get_derivatives(0, state + dt * k3);
    state += (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4);
}

// --- Main Engine Entry Point ---
int main(int argc, char* argv[]) {

    // =================================================================================
    // MODE 1: Calculate Mode (Interplanetary Lambert/RK4 Solver for Frontend API)
    // =================================================================================
    if (argc >= 2 && std::string(argv[1]) == "calculate") {
        std::string input, line;
        while (std::getline(std::cin, line)) input += line;

        // --- Parse targetPlanet from JSON string ---
        std::string targetPlanet = "Mars";
        {
            auto tp = input.find("\"targetPlanet\"");
            if (tp != std::string::npos) {
                auto s = input.find("\"", tp + 14); s++;
                auto e = input.find("\"", s);
                if (e != std::string::npos) targetPlanet = input.substr(s, e - s);
            }
        }

        // --- Parse launchPlanet from JSON string ---
        std::string launchPlanet = "Earth";
        {
            auto lp = input.find("\"launchPlanet\"");
            if (lp != std::string::npos) {
                auto s = input.find("\"", lp + 14); s++;
                auto e = input.find("\"", s);
                if (e != std::string::npos) launchPlanet = input.substr(s, e - s);
            }
        }

        // --- Parse globalTime from JSON string ---
        double globalTime = 0.0;
        {
            auto gt = input.find("\"globalTime\"");
            if (gt != std::string::npos) {
                auto c = input.find(":", gt);
                if (c != std::string::npos) {
                    try { globalTime = std::stod(input.substr(c + 1)); } catch (...) {}
                }
            }
        }

        // --- Parse manual launch params (if any) ---
        double manualV0 = -1.0, manualPitch = 0.0, manualYaw = 0.0;
        bool isManual = false;
        bool autoRoute = true;
        {
            auto am = input.find("\"autoRoute\"");
            if (am != std::string::npos) {
                auto c = input.find(":", am);
                if (c != std::string::npos) {
                    if (input.substr(c + 1, 5).find("false") != std::string::npos) {
                        autoRoute = false;
                    }
                }
            }
            auto vm = input.find("\"v0\"");
            if (vm != std::string::npos) {
                auto c = input.find(":", vm);
                if (c != std::string::npos) {
                    try { 
                        manualV0 = std::stod(input.substr(c + 1)); 
                        if (!autoRoute) isManual = true; 
                    } catch (...) {}
                }
            }
            auto pm = input.find("\"pitch\"");
            if (pm != std::string::npos) {
                auto c = input.find(":", pm);
                if (c != std::string::npos) try { manualPitch = std::stod(input.substr(c + 1)); } catch (...) {}
            }
            auto ym = input.find("\"yaw\"");
            if (ym != std::string::npos) {
                auto c = input.find(":", ym);
                if (c != std::string::npos) try { manualYaw = std::stod(input.substr(c + 1)); } catch (...) {}
            }
        }

        auto solveKepler = [](double M, double ecc) -> double {
            double E = M;
            for (int i = 0; i < 100; i++) {
                double dE = (E - ecc * std::sin(E) - M) / (1.0 - ecc * std::cos(E));
                E -= dE;
                if (std::abs(dE) < 1e-10) break;
            }
            return E;
        };

        auto propagateOrbit = [&](const KeplerEl& el, double t) -> Eigen::Vector3d {
            double n = 2.0 * M_PI / el.period;
            double M = el.M0 + n * t;
            M = std::fmod(M, 2.0 * M_PI);
            if (M < 0) M += 2.0 * M_PI;
            double E = solveKepler(M, el.e);
            double nu = 2.0 * std::atan2(
                std::sqrt(1.0 + el.e) * std::sin(E / 2.0),
                std::sqrt(1.0 - el.e) * std::cos(E / 2.0)
            );
            double r = el.a * (1.0 - el.e * std::cos(E));
            double xOrbit = r * std::cos(nu);
            double yOrbit = r * std::sin(nu);
            double cw = std::cos(el.w), sw = std::sin(el.w);
            double cO = std::cos(el.Omega), sO = std::sin(el.Omega);
            double ci = std::cos(el.inc), si = std::sin(el.inc);
            double x = xOrbit * (cw*cO - sw*ci*sO) - yOrbit * (sw*cO + cw*ci*sO);
            double y = xOrbit * (cw*sO + sw*ci*cO) - yOrbit * (sw*sO - cw*ci*cO);
            double z = xOrbit * (sw*si) + yOrbit * (cw*si);
            return {x, y, z};
        };

        auto getOrbitalVelocity = [&](const KeplerEl& el, double t) -> Eigen::Vector3d {
            double n = 2.0 * M_PI / el.period;
            double M = el.M0 + n * t;
            M = std::fmod(M, 2.0 * M_PI);
            if (M < 0) M += 2.0 * M_PI;
            double E = solveKepler(M, el.e);
            double r = el.a * (1.0 - el.e * std::cos(E));
            double vxOrbit = -(el.a * el.a * n * std::sin(E)) / r;
            double vyOrbit = (el.a * el.a * n * std::sqrt(std::max(0.0, 1.0 - el.e*el.e)) * std::cos(E)) / r;
            double cw = std::cos(el.w), sw = std::sin(el.w);
            double cO = std::cos(el.Omega), sO = std::sin(el.Omega);
            double ci = std::cos(el.inc), si = std::sin(el.inc);
            double vx = vxOrbit * (cw*cO - sw*ci*sO) - vyOrbit * (sw*cO + cw*ci*sO);
            double vy = vxOrbit * (cw*sO + sw*ci*cO) - vyOrbit * (sw*sO - cw*ci*cO);
            double vz = vxOrbit * (sw*si) + vyOrbit * (cw*si);
            return {vx, vy, vz};
        };

        const double AU_M = 1.495978707e11;
        const double G_CONST = 6.6743015e-11;
        const double M_SUN_MASS = 1.989e30;
        const double MU_SUN_CALC = G_CONST * M_SUN_MASS;
        
        std::vector<KeplerEl> planetTable = {
            {"Mercury", 0.387*AU_M, 0.2056, 7.0*M_PI/180,   48.33*M_PI/180, 29.124*M_PI/180, 174.0*M_PI/180, 88.0*86400,      2439700,  G_CONST*3.3011e23},
            {"Venus",   0.723*AU_M, 0.0067, 3.39*M_PI/180,  76.68*M_PI/180, 54.88*M_PI/180,  50.0*M_PI/180,  224.7*86400,     6051800,  G_CONST*4.8675e24},
            {"Earth",   1.000*AU_M, 0.0167, 0.00005*M_PI/180,-11.26*M_PI/180,114.2*M_PI/180, 358.0*M_PI/180, 365.25*86400,    6371000,  G_CONST*5.97216e24},
            {"Mars",    1.524*AU_M, 0.0934, 1.85*M_PI/180,  49.57*M_PI/180, 286.5*M_PI/180,  19.0*M_PI/180,  686.98*86400,    3389500,  G_CONST*6.4171e23},
            {"Jupiter", 5.204*AU_M, 0.0489, 1.3*M_PI/180,   100.4*M_PI/180, 273.8*M_PI/180,  20.0*M_PI/180,  4332.59*86400,   69911000, G_CONST*1.8982e27},
            {"Saturn",  9.582*AU_M, 0.0565, 2.48*M_PI/180,  113.6*M_PI/180, 339.3*M_PI/180,  317.0*M_PI/180, 10759.0*86400,   58232000, G_CONST*5.6834e26},
            {"Uranus",  19.201*AU_M,0.0457, 0.77*M_PI/180,  74.0*M_PI/180,  96.6*M_PI/180,   142.0*M_PI/180, 30688.0*86400,   25362000, G_CONST*8.6810e25},
            {"Neptune", 30.047*AU_M,0.0113, 1.77*M_PI/180,  131.7*M_PI/180, 273.1*M_PI/180,  256.0*M_PI/180, 60182.0*86400,   24622000, G_CONST*1.02413e26},
        };

        KeplerEl* originEl  = nullptr;
        KeplerEl* targetEl = nullptr;
        for (auto& p : planetTable) {
            if (p.name == launchPlanet)  originEl  = &p;
            if (p.name == targetPlanet)  targetEl = &p;
        }
        if (!originEl || !targetEl) {
            std::cout << "{\"error\":\"Planet not found\"}" << std::endl;
            return 1;
        }

        auto C_stump = [](double z) -> double {
            if (z >  1e-6) return (1.0 - std::cos(std::sqrt(z))) / z;
            if (z < -1e-6) return (std::cosh(std::sqrt(-z)) - 1.0) / (-z);
            return 0.5 - z/24.0 + z*z/720.0;
        };

        auto S_stump = [](double z) -> double {
            if (z >  1e-6) { double sq = std::sqrt(z); return (sq - std::sin(sq)) / (sq*sq*sq); }
            if (z < -1e-6) { double sq = std::sqrt(-z); return (std::sinh(sq) - sq) / (sq*sq*sq); }
            return 1.0/6.0 - z/120.0 + z*z/5040.0;
        };

        auto solveLambert = [&](const Eigen::Vector3d& r1, const Eigen::Vector3d& r2, double tof) -> Eigen::Vector3d {
            double n1 = r1.norm(), n2 = r2.norm();
            double cosDnu = r1.dot(r2) / (n1 * n2);
            double cr_z = r1.x()*r2.y() - r1.y()*r2.x();
            double dnu = std::acos(std::max(-1.0, std::min(1.0, cosDnu)));
            if (cr_z < 0) dnu = 2.0*M_PI - dnu;
            
            if (std::abs(1.0 - cosDnu) < 1e-8) {
                throw std::runtime_error("Degenerate Lambert geometry (angle ~ 0)");
            }
            if (std::abs(-1.0 - cosDnu) < 1e-8) {
                throw std::runtime_error("Degenerate Lambert geometry (angle ~ 180)");
            }
            
            double A = std::sin(dnu) * std::sqrt(n1*n2 / (1.0 - std::cos(dnu)));
            double zLow = -4.0*M_PI*M_PI, zHigh = 4.0*M_PI*M_PI, z = 0.0, y = 0.0;
            
            for (int iter = 0; iter < 200; iter++) {
                double cVal = C_stump(z), sVal = S_stump(z);
                if (cVal < 1e-12) { zLow = z; z = (z+zHigh)/2.0; continue; }
                y = n1 + n2 + A*(z*sVal - 1.0) / std::sqrt(cVal);
                if (y < 0) {
                    if (A > 0) zLow = z; else zHigh = z;
                    z = (zHigh + zLow) / 2.0;
                    continue;
                }
                double x = std::sqrt(y / cVal);
                double tCalc = (x*x*x*sVal + A*std::sqrt(y)) / std::sqrt(MU_SUN_CALC);
                if (std::abs(tCalc - tof) < std::max(0.01, 1e-7*tof)) break;
                if (tCalc < tof) zLow = z; else zHigh = z;
                z = (zHigh + zLow) / 2.0;
                if (std::abs(zHigh - zLow) < 1e-4) break;
            }
            double f = 1.0 - y/n1;
            double g = A * std::sqrt(y / MU_SUN_CALC);
            return (r2 - f*r1) / g;
        };

        // --- Find optimal transfer (Search Departure Window + TOF) ---
        double minDV = 1e18;
        double bestTof = 0, bestDepTime = globalTime;
        Eigen::Vector3d bestV0;
        
        if (isManual) {
            bestTof = 400.0 * 86400.0;
            bestDepTime = globalTime;
            
            double pitch_rad = manualPitch * M_PI / 180.0;
            double yaw_rad = manualYaw * M_PI / 180.0;
            
            Eigen::Vector3d vOrigin = getOrbitalVelocity(*originEl, bestDepTime);
            Eigen::Vector3d rOrigin = propagateOrbit(*originEl, bestDepTime);
            
            Eigen::Vector3d p_hat = vOrigin.normalized();
            Eigen::Vector3d h_vec = rOrigin.cross(vOrigin);
            Eigen::Vector3d n_hat = h_vec.normalized();
            Eigen::Vector3d r_hat = n_hat.cross(p_hat).normalized(); // "radial-ish", points outward in plane
            
            // v0 components: cos(pitch)cos(yaw) loosely goes prograde, sin(yaw) goes normal, sin(pitch) goes radial
            Eigen::Vector3d v_inf = (
                p_hat * std::cos(pitch_rad) * std::cos(yaw_rad) +
                n_hat * std::cos(pitch_rad) * std::sin(yaw_rad) +
                r_hat * std::sin(pitch_rad)
            ) * manualV0;
            
            bestV0 = vOrigin + v_inf * 1000.0; // convert km/s to m/s
        } else {
            double minDays = 100.0, maxDays = 400.0;
            double coarseStep = 10.0;
            
            std::string targetLower = targetPlanet;
            for (auto &c : targetLower) c = std::tolower(c);
            std::string originLower = launchPlanet;
            for (auto &c : originLower) c = std::tolower(c);

            if (targetLower == "mercury" || originLower == "mercury") {
                minDays = 50.0; maxDays = 200.0; coarseStep = 5.0;
            } else if (targetLower == "venus" || originLower == "venus") {
                minDays = 80.0; maxDays = 250.0; coarseStep = 5.0;
            } else if (targetLower == "mars" || originLower == "mars") {
                minDays = 150.0; maxDays = 500.0; coarseStep = 10.0;
            } else if (targetLower == "jupiter" || originLower == "jupiter") {
                minDays = 400.0; maxDays = 1200.0; coarseStep = 20.0;
            } else if (targetLower == "saturn" || originLower == "saturn") {
                minDays = 800.0; maxDays = 3000.0; coarseStep = 40.0;
            } else if (targetLower == "uranus" || originLower == "uranus") {
                minDays = 2000.0; maxDays = 8000.0; coarseStep = 100.0;
            } else if (targetLower == "neptune" || originLower == "neptune") {
                minDays = 3000.0; maxDays = 15000.0; coarseStep = 200.0;
            }

            double maxDepOffset = 400.0;
            if (targetLower == "mercury" || originLower == "mercury") {
                maxDepOffset = 180.0;
            } else if (targetLower == "venus" || originLower == "venus") {
                maxDepOffset = 600.0;
            } else if (targetLower == "mars" || originLower == "mars") {
                maxDepOffset = 800.0;
            } else if (targetLower == "jupiter" || originLower == "jupiter") {
                maxDepOffset = 600.0;
            } else if (targetLower == "saturn" || originLower == "saturn") {
                maxDepOffset = 600.0;
            } else if (targetLower == "uranus" || originLower == "uranus") {
                maxDepOffset = 600.0;
            } else if (targetLower == "neptune" || originLower == "neptune") {
                maxDepOffset = 600.0;
            }

            // Search for the best launch day in a dynamic window
            for (double depOffset = 0; depOffset <= maxDepOffset; depOffset += 10.0) {
                double currentDepTime = globalTime + (depOffset * 86400.0);
                for (double d = minDays; d <= maxDays; d += coarseStep) {
                    double tof = d * 86400.0;
                    Eigen::Vector3d r1 = propagateOrbit(*originEl, currentDepTime);
                    Eigen::Vector3d r2 = propagateOrbit(*targetEl, currentDepTime + tof);
                    Eigen::Vector3d vOrigin = getOrbitalVelocity(*originEl, currentDepTime);
                    try {
                        Eigen::Vector3d vL = solveLambert(r1, r2, tof);
                        double dv = (vL - vOrigin).norm();
                        if (dv < minDV) { 
                            minDV = dv; 
                            bestTof = tof; 
                            bestV0 = vL; 
                            bestDepTime = currentDepTime;
                        }
                    } catch (...) {}
                }
            }
        }

        // --- RK4 integrate and sample 500 points ---
        Eigen::Vector3d sc_pos = propagateOrbit(*originEl, bestDepTime);
        Eigen::Vector3d sc_vel = bestV0;
        const int N = 500;
        double dt_step = bestTof / N;
        std::vector<std::array<double,3>> pts;
        pts.reserve(N + 1);
        
        auto deriv = [&](const Eigen::Vector3d& p, const Eigen::Vector3d& v) {
            double r = p.norm();
            return std::make_pair(v, -MU_SUN_CALC * p / (r*r*r));
        };
        
        for (int i = 0; i <= N; i++) {
            pts.push_back({sc_pos.x(), sc_pos.y(), sc_pos.z()});
            if (i < N) {
                double dt_accum = 0;
                while (dt_accum < dt_step) {
                    double current_dt = std::min(86400.0, dt_step - dt_accum); // max 1 day step
                    auto [v1,a1] = deriv(sc_pos, sc_vel);
                    auto [v2,a2] = deriv(sc_pos+0.5*current_dt*v1, sc_vel+0.5*current_dt*a1);
                    auto [v3,a3] = deriv(sc_pos+0.5*current_dt*v2, sc_vel+0.5*current_dt*a2);
                    auto [v4,a4] = deriv(sc_pos+current_dt*v3,     sc_vel+current_dt*a3);
                    sc_pos += (current_dt/6.0)*(v1 + 2.0*v2 + 2.0*v3 + v4);
                    sc_vel += (current_dt/6.0)*(a1 + 2.0*a2 + 2.0*a3 + a4);
                    dt_accum += current_dt;
                }
            }
        }

        // --- Capture check ---
        double max_dv = 100000.0; // unlimited budget
        Eigen::Vector3d vOriginDep = getOrbitalVelocity(*originEl, bestDepTime);
        double total_dv = (bestV0 - vOriginDep).norm();
        
        bool captured = false;
        double remaining = 0.0;
        
        if (isManual) {
            // Find minimum distance to targetEl during the 400 days
            double minDist = 1e18;
            for (int i = 0; i <= N; i++) {
                double t_shuttle = bestDepTime + i * dt_step;
                Eigen::Vector3d p_targ = propagateOrbit(*targetEl, t_shuttle);
                Eigen::Vector3d p_shut(pts[i][0], pts[i][1], pts[i][2]);
                double d = (p_targ - p_shut).norm();
                if (d < minDist) minDist = d;
            }
            // Roughly within 5 million km for a generic "close encounter" or capture
            // It's a rough check for user feedback.
            captured = (minDist <= 5000000.0 * 1000.0); // 5M km in meters
        } else {
            captured = (total_dv <= max_dv);
            remaining = max_dv - total_dv;
        }

        double capture_alt = targetEl->radius_m / 1000.0 * 0.3;
        double muTarget = targetEl->mu;
        double rp = targetEl->radius_m * 1.3;
        double orbitPeriod = 2.0 * M_PI * std::sqrt(rp*rp*rp / muTarget) / 86400.0;
        
        double timeToWait = bestDepTime - globalTime;
        bool isReadyToLaunch = (timeToWait <= 86400.0);

        std::cout << std::fixed << std::setprecision(3);
        std::cout << "{\"points\":[";
        for (int i = 0; i < (int)pts.size(); i++) {
            if (i) std::cout << ",";
            std::cout << "[" << pts[i][0] << "," << pts[i][1] << "," << pts[i][2] << "]";
        }
        std::cout << "],"
                  << "\"arrivalTime\":"     << (bestDepTime + bestTof) << ","
                  << "\"success\":"         << (captured ? "true" : "false") << ","
                  << "\"missionStatus\":\"" << (captured ? "ORBIT CAPTURE" : "OVERSHOT") << "\","
                  << "\"captureAltitude\":" << capture_alt << ","
                  << "\"orbitPeriod\":"     << orbitPeriod << ","
                  << "\"isOvershot\":"      << (captured ? "false" : "true") << ","
                  << "\"remainingDeltaV\":" << remaining << ","
                  << "\"usedDuration\":"    << bestTof << ","
                  << "\"simStartTime\":"    << bestDepTime << ","
                  << "\"dvLabel\":"         << total_dv << ","
                  << "\"vReq\":"            << (bestV0.norm() / 1000.0) << ","
                  << "\"isReadyToLaunch\":" << (isReadyToLaunch ? "true" : "false") << ","
                  << "\"timeToWait\":"      << timeToWait
                  << "}" << std::endl;
        return 0;
    }

    // =================================================================================
    // MODE 2: Default Gravity Assist / Low Earth Orbit Test Mode
    // =================================================================================
    GravityAssistPlanner planner;
    const Planet& jupiter = planner.fleet[1];
    Eigen::Vector3d v_inbound(5600.0, 11000.0, 0.0);
    Eigen::Vector3d v_outbound_target(8200.0, 14200.0, 0.0);
    
    double delta_v_gained = 0.0;
    bool is_cremated = false;
    double rp = planner.PlanSlingshot(jupiter, v_inbound, v_outbound_target, delta_v_gained, is_cremated);
    
    std::cerr << "=== SLINGSHOT ===" << std::endl;
    std::cerr << "dv: " << delta_v_gained << " rp: " << rp/1000.0 << " km safe: " << (!is_cremated?"OK":"DANGER") << std::endl;
    
    double t_target = 0.0;
    if (argc > 1) { 
        try { t_target = std::stod(argv[1]); } catch (...) {} 
    }
    
    double alt0 = 100000.0;
    double r0 = RE + alt0;
    double v0 = std::sqrt(MU/r0);
    
    StateVector state;
    state << r0, 0, 0, 0, v0 * std::cos(51.6*M_PI/180.0), v0 * std::sin(51.6*M_PI/180.0);
    
    double dt = 1.0;
    for(double t = 0; t < t_target; t += dt) {
        rk4_step(state, std::min(dt, t_target - t));
    }
    
    double x = state(0), y = state(1), z = state(2);
    double r = std::sqrt(x*x + y*y + z*z);
    
    double lat = std::asin(z / r) * 180.0 / M_PI;
    double lon = std::atan2(y, x) * 180.0 / M_PI;
    double alt = r - RE;
    lon = std::fmod(lon - (t_target * 0.004178), 360.0);
    
    if (lon < -180.0) lon += 360.0; 
    if (lon >  180.0) lon -= 360.0;
    
    std::cout << std::fixed << std::setprecision(6)
              << "{\"x\":" << x << ",\"y\":" << y << ",\"z\":" << z
              << ",\"vx\":" << state(3) << ",\"vy\":" << state(4) << ",\"vz\":" << state(5)
              << ",\"lat\":" << lat << ",\"lon\":" << lon << ",\"alt\":" << alt
              << ",\"status\":\"" << (alt < 100000 ? "WARNING_ATMOSPHERIC_REENTRY" : "NOMINAL") << "\""
              << ",\"slingshot_rp\":" << rp << ",\"slingshot_dv\":" << delta_v_gained
              << ",\"slingshot_safe\":" << (is_cremated ? 0 : 1) << "}" << std::endl;
              
    return 0;
}