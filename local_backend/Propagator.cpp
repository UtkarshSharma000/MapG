#include <iostream>
#include <vector>
#include <cmath>
#include <chrono>
#include <thread>
#include <iomanip>
#include <Eigen/Dense>

using namespace std;
using namespace Eigen;

/**
 * Odyssey 2026: Orbital Propagator (v2)
 * High-performance C++ Digital Twin
 */

const double MU = 398600.4418;  // Earth Gravitational Constant (km^3/s^2)
const double RE = 6378.137;     // Earth Equatorial Radius (km)
const double J2 = 1.08262668e-3;// J2 Perturbation Coefficient

// Atmospheric Drag Constants
const double RHO0 = 2e-12; // Reference density at h0 (kg/m^3)
const double H0 = 150.0;   // Reference altitude (km)
const double SH = 8.5;     // Scale height (km)
const double CD = 2.2;     // Drag Coefficient
const double AM = 0.01;    // Area-to-mass ratio (m^2/kg)

using State = Matrix<double, 6, 1>;

State get_derivatives(const State& state) {
    Vector3d r_vec = state.segment<3>(0);
    Vector3d v_vec = state.segment<3>(3);
    double r = r_vec.norm();
    double r3 = r * r * r;

    // 1. Two-body Gravity
    Vector3d acc = -MU / r3 * r_vec;

    // 2. J2 Perturbation
    double z = r_vec(2);
    double r2 = r * r;
    double j2_const = 1.5 * J2 * MU * pow(RE, 2) / pow(r, 5);
    
    acc(0) += j2_const * r_vec(0) * (5.0 * pow(z, 2) / r2 - 1.0);
    acc(1) += j2_const * r_vec(1) * (5.0 * pow(z, 2) / r2 - 1.0);
    acc(2) += j2_const * r_vec(2) * (5.0 * pow(z, 2) / r2 - 3.0);

    // 3. Atmospheric Drag (< 200km)
    double altitude = r - RE;
    if (altitude < 200.0) {
        double rho = RHO0 * exp(-(altitude - H0) / SH);
        double v_rel = v_vec.norm();
        // acc_drag = -0.5 * Cd * A/m * rho * v_rel * v_vec
        // Need to ensure units match km/s^2. rho is kg/m^3. A/m is m^2/kg.
        // (m^2/kg) * (kg/m^3) * (km/s) * (km/s) -> result should be km/s^2
        Vector3d acc_drag = -0.5 * CD * AM * rho * 1000.0 * v_rel * v_vec;
        acc += acc_drag;
    }

    State dstate;
    dstate.segment<3>(0) = v_vec;
    dstate.segment<3>(3) = acc;
    return dstate;
}

void step_rk4(State& state, double dt) {
    State k1 = get_derivatives(state);
    State k2 = get_derivatives(state + 0.5 * dt * k1);
    State k3 = get_derivatives(state + 0.5 * dt * k2);
    State k4 = get_derivatives(state + dt * k3);
    state += (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4);
}

int main() {
    // Starting in LEO: 7000 km from center (~622km altitude)
    State state;
    state << 7000.0, 0.0, 0.0,  // r (km)
             0.0, 7.5, 0.5;     // v (km/s) - slightly inclined circularish orbit

    double t = 0.0;
    double dt = 0.5;

    while (true) {
        step_rk4(state, dt);
        t += dt;

        double altitude = state.segment<3>(0).norm() - RE;

        // JSON Output for Bridge
        cout << fixed << setprecision(6)
             << "{"
             << "\"x\":" << state(0) << ","
             << "\"y\":" << state(1) << ","
             << "\"z\":" << state(2) << ","
             << "\"vx\":" << state(3) << ","
             << "\"vy\":" << state(4) << ","
             << "\"vz\":" << state(5) << ","
             << "\"altitude\":" << altitude << ","
             << "\"time\":" << t
             << "}" << endl;

        this_thread::sleep_for(chrono::milliseconds(500));
    }
    return 0;
}
