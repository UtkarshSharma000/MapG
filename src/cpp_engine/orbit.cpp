#include <iostream>
#include <string>
#include <cmath>
#include <vector>
#include <iomanip>
#include <memory>
#include <algorithm>
#include <Eigen/Dense>

// --- PHYSICAL CONSTANTS ---
const double G = 6.67430e-11;                        // m^3 / kg / s^2
const double MU_SUN = 1.32712440018e20;              // m^3 / s^2
const double AU = 1.495978707e11;                    // m

// Legacy definitions for Earth UI telemetry compatibility
const double MU = 3.986004418e14; // Earth's gravitational parameter, m^3/s^2
const double RE = 6371000.0;      // Earth's mean radius, m

typedef Eigen::Matrix<double, 6, 1> StateVector;

// --- PLANETARY STRUCTURE ---
struct Planet {
    std::string name;
    double mass;             // kg
    double radius;           // m
    double atmosphere_limit; // m (atmospheric entry cushion)
    double mu;               // m^3 / s^2 (G * mass)
    double semi_major_axis;  // m (heliocentric)
    double orbital_period;   // seconds
    
    // Position & Velocity in Heliocentric frames
    Eigen::Vector3d pos;
    Eigen::Vector3d vel;
};

// --- MULTI-BODY SYSTEM INITIALIZATION ---
std::vector<Planet> InitializeSolarSystem() {
    std::vector<Planet> planets;
    
    // Add planetary coordinates (Approximated circular coplanar orbits for clarity in analytical targeting)
    // 1. Earth
    planets.push_back({
        "Earth", 5.9722e24, 6371000.0, 120000.0, G * 5.9722e24, 
        1.00 * AU, 365.25 * 86400.0, 
        Eigen::Vector3d(1.00 * AU, 0.0, 0.0), 
        Eigen::Vector3d(0.0, 29780.0, 0.0)
    });
    
    // 2. Jupiter
    planets.push_back({
        "Jupiter", 1.8982e27, 69911000.0, 1000000.0, G * 1.8982e27, 
        5.20 * AU, 11.86 * 365.25 * 86400.0,
        Eigen::Vector3d(5.20 * AU, 0.0, 0.0),
        Eigen::Vector3d(0.0, 13070.0, 0.0)
    });
    
    // 3. Saturn
    planets.push_back({
        "Saturn", 5.6834e26, 58232000.0, 1000000.0, G * 5.6834e26, 
        9.58 * AU, 29.45 * 365.25 * 86400.0,
        Eigen::Vector3d(9.58 * AU, 0.0, 0.0),
        Eigen::Vector3d(0.0, 9690.0, 0.0)
    });
    
    // 4. Uranus
    planets.push_back({
        "Uranus", 8.6810e25, 25362000.0, 500000.0, G * 8.6810e25, 
        19.22 * AU, 84.01 * 365.25 * 86400.0,
        Eigen::Vector3d(19.22 * AU, 0.0, 0.0),
        Eigen::Vector3d(0.0, 6810.0, 0.0)
    });
    
    // 5. Neptune
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

    // Step 1: High performance RK4 N-Body Integrator
    void StateVectorPropagateRK4(Eigen::Vector3d& sc_pos, Eigen::Vector3d& sc_vel, double dt) {
        auto derivatives = [&](const Eigen::Vector3d& p, const Eigen::Vector3d& v) {
            // Sun Central Gravitational Field
            double r_sun = p.norm();
            Eigen::Vector3d acc = -MU_SUN * p / (r_sun * r_sun * r_sun);
            
            // Scaled Multi-body perturbations from nearest planet
            double min_dist = INFINITY;
            const Planet* nearest_planet = nullptr;
            for (const auto& planet : fleet) {
                double d = (p - planet.pos).norm();
                if (d < min_dist) {
                    min_dist = d;
                    nearest_planet = &planet;
                }
            }
            
            // Add patched relative conics gravitational pull of nearest planet
            if (nearest_planet) {
                Eigen::Vector3d r_rel = p - nearest_planet->pos;
                double d_rel = r_rel.norm();
                // Avoid singularity with soft-margin thresholding at planetary center
                double soft_d = std::max(d_rel, nearest_planet->radius * 0.5);
                acc += -nearest_planet->mu * r_rel / (soft_d * soft_d * soft_d);
            }
            return std::make_pair(v, acc);
        };

        // RK4 Integration step
        auto [v1, a1] = derivatives(sc_pos, sc_vel);
        auto [v2, a2] = derivatives(sc_pos + 0.5 * dt * v1, sc_vel + 0.5 * dt * a1);
        auto [v3, a3] = derivatives(sc_pos + 0.5 * dt * v2, sc_vel + 0.5 * dt * a2);
        auto [v4, a4] = derivatives(sc_pos + dt * v3, sc_vel + dt * a3);

        sc_pos += (dt / 6.0) * (v1 + 2.0 * v2 + 2.0 * v3 + v4);
        sc_vel += (dt / 6.0) * (a1 + 2.0 * a2 + 2.0 * a3 + a4);
    }

    // Step 2: Slingshot Hyperbolic Patched Conics Calculations
    // Targets the launch or target swingby planet, outputting flyby periapsis rp
    double PlanSlingshot(const Planet& swingby_body, 
                         const Eigen::Vector3d& v_sc_in, 
                         const Eigen::Vector3d& v_target_out, 
                         double& actual_delta_v, 
                         bool& atmospheric_impact) {
        
        // Planetocentric excess velocities at infinity (V_inf)
        Eigen::Vector3d v_inf_in = v_sc_in - swingby_body.vel;
        double v_inf = v_inf_in.norm();
        
        // Target outgoing excess velocity vector
        Eigen::Vector3d v_inf_out = v_target_out - swingby_body.vel;
        
        // Match magnitude for hyperbola energy conservation
        v_inf_out = v_inf_out.normalized() * v_inf;
        
        // Calculate deflection angle theta
        double cos_theta = v_inf_in.dot(v_inf_out) / (v_inf * v_inf);
        // Clamp to secure domain margins
        cos_theta = std::max(-1.0, std::min(1.0, cos_theta));
        double theta = std::acos(cos_theta);
        
        // Calculate target periapsis radius rp
        double sin_half_theta = std::sin(theta / 2.0);
        double rp = 0.0;
        
        if (sin_half_theta > 0.0) {
            rp = (swingby_body.mu / (v_inf * v_inf)) * ((1.0 / sin_half_theta) - 1.0);
        } else {
            rp = swingby_body.radius; // Extreme case: rectilinear passing
        }
        
        // Check structural limits (reentry / impact safety threshold)
        double safety_margin = swingby_body.radius + swingby_body.atmosphere_limit;
        atmospheric_impact = (rp < safety_margin);
        
        // Total Heliocentric Velocity delta gained (slingshot energy booster)
        actual_delta_v = (v_inf_out - v_inf_in).norm();
        
        return rp;
    }
};

// --- LEGACY EARTH SIMULATION UTILITIES ---
StateVector get_derivatives(double t, const StateVector& state) {
    double x = state(0);
    double y = state(1);
    double z = state(2);
    
    double r = std::sqrt(x*x + y*y + z*z);
    double r3 = r * r * r;
    
    double ax = -MU * x / r3;
    double ay = -MU * y / r3;
    double az = -MU * z / r3;
    
    StateVector dstate;
    dstate << state(3), state(4), state(5), ax, ay, az;
    return dstate;
}

void rk4_step(StateVector& state, double dt) {
    StateVector k1 = get_derivatives(0.0, state);
    StateVector k2 = get_derivatives(0.0, state + 0.5 * dt * k1);
    StateVector k3 = get_derivatives(0.0, state + 0.5 * dt * k2);
    StateVector k4 = get_derivatives(0.0, state + dt * k3);
    
    state += (dt / 6.0) * (k1 + 2.0*k2 + 2.0*k3 + k4);
}

// --- MAIN CONTROLLER COUPLING ---
int main(int argc, char* argv[]) {
    // 1. Perform analytical tests of the Gravity Assist solver for console logging/verification
    GravityAssistPlanner planner;
    
    // Target Planet swingby: Jupiter (Voyager grand tour style slingshot)
    const Planet& jupiter = planner.fleet[1]; // Jupiter element index
    
    // Inbound heliocentric probe velocity (derived from Earth-Jupiter Hohmann-like transfer arrival)
    Eigen::Vector3d v_inbound(5600.0, 11000.0, 0.0);  // m/s
    
    // Target outbound heliocentric velocity direction vector to reach Uranus/Saturn
    Eigen::Vector3d v_outbound_target(8200.0, 14200.0, 0.0); // Required heliocentric outgoing vector
    
    double delta_v_gained = 0.0;
    bool is_cremated = false;
    double rp = planner.PlanSlingshot(jupiter, v_inbound, v_outbound_target, delta_v_gained, is_cremated);
    
    // Log scientific details internally to stderr so stdout is clean for telemetry JSON
    std::cerr << "=== DEEP SPACE SLINGSHOT PLANNER CALCULATIONS ===" << std::endl;
    std::cerr << "Swing-by body target: " << jupiter.name << std::endl;
    std::cerr << "Heliocentric booster gain (Delta V): " << delta_v_gained << " m/s" << std::endl;
    std::cerr << "Calculated periapsis radius (rp): " << (rp / 1000.0) << " km" << std::endl;
    std::cerr << "Altitude above clouds: " << ((rp - jupiter.radius) / 1000.0) << " km" << std::endl;
    std::cerr << "Atmospheric penetration warning: " << (is_cremated ? "DANGER ACCIDENTAL ENTRY" : "SAFE OUTSIDE SOI CORRIDOR") << std::endl;
    std::cerr << "=================================================" << std::endl;

    // 2. Legacy UI-Coupled Earth Trajectory loop
    double t_target = 0.0;
    if (argc > 1) {
        t_target = std::stod(argv[1]);
    } else {
        std::cerr << "Warning: No time argument specified. Defaulting to 0.0" << std::endl;
    }
    
    // Initial conditions (100km altitude, circular orbit, 51.6deg inclination)
    double alt0 = 100000.0;
    double r0 = RE + alt0;
    double v0 = std::sqrt(MU / r0);
    
    StateVector state;
    state << r0, 0.0, 0.0, 0.0, v0 * std::cos(51.6 * M_PI/180.0), v0 * std::sin(51.6 * M_PI/180.0);
    
    // Decay factor (simulate slight drag decreasing altitude to demonstrate reentry)
    double decay_rate = 5.0; // 5 meters drops every second
    
    double dt = 1.0;
    for(double t = 0; t < t_target; t += dt) {
        double step = std::min(dt, t_target - t);
        rk4_step(state, step);
    }
    
    double x = state(0);
    double y = state(1);
    double z = state(2);
    double r = std::sqrt(x*x + y*y + z*z);
    
    // Adding simulated drag effect simply for demonstration of constraints
    double actual_r = r - (decay_rate * t_target);
    double fix_ratio = actual_r / r;
    x *= fix_ratio; y *= fix_ratio; z *= fix_ratio;
    
    double lat = std::asin(z / actual_r) * 180.0 / M_PI;
    double lon = std::atan2(y, x) * 180.0 / M_PI;
    double alt = actual_r - RE;
    
    // We adjust lon by incorporating Earth rotation
    lon = std::fmod(lon - (t_target * 0.004178), 360.0);
    if (lon < -180.0) lon += 360.0;
    if (lon > 180.0) lon -= 360.0;

    std::string status = "NOMINAL";
    if (alt < 100000.0) {
        status = "WARNING_ATMOSPHERIC_REENTRY";
    }
    
    std::cout << "{" 
              << "\"x\":" << x << ","
              << "\"y\":" << y << ","
              << "\"z\":" << z << ","
              << "\"vx\":" << state(3) << ","
              << "\"vy\":" << state(4) << ","
              << "\"vz\":" << state(5) << ","
              << "\"lat\":" << lat << ","
              << "\"lon\":" << lon << ","
              << "\"alt\":" << alt << ","
              << "\"status\":\"" << status << "\","
              << "\"slingshot_rp\":" << rp << ","
              << "\"slingshot_dv\":" << delta_v_gained << ","
              << "\"slingshot_safe\":" << (is_cremated ? 0 : 1)
              << "}" << std::endl;
               
    return 0;
}
