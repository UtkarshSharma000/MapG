#include <iostream>
#include <string>
#include <cmath>
#include <vector>
#include <Eigen/Dense>

const double MU = 3.986004418e14; // Earth's gravitational parameter, m^3/s^2
const double RE = 6371000.0;      // Earth's mean radius, m

typedef Eigen::Matrix<double, 6, 1> StateVector;

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

int main(int argc, char* argv[]) {
    // Usage: ./orbit_engine <elapsed_time_seconds>
    double t_target = 0.0;
    if (argc > 1) {
        t_target = std::stod(argv[1]);
    } else {
        std::cerr << "Error: Must provide elapsed time in seconds." << std::endl;
        return 1;
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
    // Earth rotates 360 deg in ~86164 seconds -> ~0.004178 deg/s
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
              << "\"status\":\"" << status << "\""
              << "}" << std::endl;
              
    return 0;
}
