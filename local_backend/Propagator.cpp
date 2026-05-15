#include <iostream>
#include <vector>
#include <cmath>
#include <chrono>
#include <thread>
#include <iomanip>
#include <Eigen/Dense>
#include <string>
#include "GuidanceComputer.hpp"

using namespace std;
using namespace Eigen;

/**
 * Odyssey 2026: Orbital Propagator (v3)
 * High-performance C++ Digital Twin - N-Body Edition
 */

const double MU_EARTH = 398600.4418;  
const double RE = 6378.137;     
const double J2 = 1.08262668e-3;

// N-Body Constants
const double MU_SUN = 132712440018.0;
const double MU_MOON = 4902.8;
const double MU_JUPITER = 126686534.0;

// Atmospheric Drag Constants
const double RHO0 = 2e-12; 
const double H0 = 150.0;   
const double SH = 8.5;     
const double CD = 2.2;     
const double AM = 0.01;    

using State = Matrix<double, 6, 1>;

struct Body {
    string name;
    double mu;
    Vector3d pos;
};

Vector3d get_sun_pos(double t) {
    double omega = 2.0 * M_PI / 31557600.0;
    double r = 149597870.0;
    return Vector3d(r * cos(omega * t), r * sin(omega * t), 0);
}

Vector3d get_moon_pos(double t) {
    double omega = 2.0 * M_PI / (27.3 * 86400.0);
    double r = 384400.0;
    return Vector3d(r * cos(omega * t), r * sin(omega * t), r * 0.087 * sin(omega * t));
}

Vector3d get_jupiter_pos(double t) {
    double omega = 2.0 * M_PI / (11.86 * 31557600.0);
    double r = 778500000.0;
    Vector3d pos_sun = get_sun_pos(t);
    Vector3d pos_jup_sun(r * cos(omega * t), r * sin(omega * t), 0);
    return pos_sun + pos_jup_sun;
}

State get_derivatives(const State& state, double t, bool nbody_enabled) {
    Vector3d r_vec = state.segment<3>(0);
    Vector3d v_vec = state.segment<3>(3);
    double r = r_vec.norm();
    double r3 = r * r * r;

    // 1. Two-body Gravity
    Vector3d acc = -MU_EARTH / r3 * r_vec;

    // 2. J2 Perturbation
    double z = r_vec(2);
    double r2 = r * r;
    double j2_const = 1.5 * J2 * MU_EARTH * pow(RE, 2) / pow(r, 5);
    
    acc(0) += j2_const * r_vec(0) * (5.0 * pow(z, 2) / r2 - 1.0);
    acc(1) += j2_const * r_vec(1) * (5.0 * pow(z, 2) / r2 - 1.0);
    acc(2) += j2_const * r_vec(2) * (5.0 * pow(z, 2) / r2 - 3.0);

    // 3. N-Body Perturbations
    if (nbody_enabled) {
        vector<Body> bodies = {
            {"Sun", MU_SUN, get_sun_pos(t)},
            {"Moon", MU_MOON, get_moon_pos(t)},
            {"Jupiter", MU_JUPITER, get_jupiter_pos(t)}
        };

        for (const auto& body : bodies) {
            Vector3d r_body_sat = body.pos - r_vec;
            Vector3d r_body_earth = body.pos;
            double r_bs3 = pow(r_body_sat.norm(), 3);
            double r_be3 = pow(r_body_earth.norm(), 3);
            acc += body.mu * (r_body_sat / r_bs3 - r_body_earth / r_be3);
        }
    }

    // 4. Atmospheric Drag (< 200km)
    double altitude = r - RE;
    if (altitude < 200.0 && altitude > 0) {
        double rho = RHO0 * exp(-(altitude - H0) / SH);
        double v_rel = v_vec.norm();
        Vector3d acc_drag = -0.5 * CD * AM * rho * 1000.0 * v_rel * v_vec;
        acc += acc_drag;
    }

    State dstate;
    dstate.segment<3>(0) = v_vec;
    dstate.segment<3>(3) = acc;
    return dstate;
}

void step_rk4(State& state, double& t, double dt, bool nbody_enabled) {
    State k1 = get_derivatives(state, t, nbody_enabled);
    State k2 = get_derivatives(state + 0.5 * dt * k1, t + 0.5 * dt, nbody_enabled);
    State k3 = get_derivatives(state + 0.5 * dt * k2, t + 0.5 * dt, nbody_enabled);
    State k4 = get_derivatives(state + dt * k3, t + dt, nbody_enabled);
    state += (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4);
    t += dt;
}

int main(int argc, char* argv[]) {
    State state;
    bool preview_mode = false;
    bool nbody_enabled = true;

    state << 7000.0, 0.0, 0.0,  
             0.0, 7.5, 0.5;

    if (argc >= 10 && string(argv[1]) == "preview") {
        preview_mode = true;
        
        double vx = stod(argv[2]);
        double vy = stod(argv[3]);
        double vz = stod(argv[4]);
        nbody_enabled = stoi(argv[5]) == 1;
        
        double start_lat = stod(argv[6]);
        double start_lon = stod(argv[7]);
        double target_lat = stod(argv[8]);
        double target_lon = stod(argv[9]);
        
        double lat_rad = start_lat * M_PI / 180.0;
        double lon_rad = start_lon * M_PI / 180.0;
        // Start 400km above surface
        double rx = (RE + 400.0) * cos(lat_rad) * cos(lon_rad);
        double ry = (RE + 400.0) * cos(lat_rad) * sin(lon_rad);
        double rz = (RE + 400.0) * sin(lat_rad);
        
        state << rx, ry, rz,
                 vx, vy, vz;

        // If a target is provided (not both 0), run the landing path predictor
        if (target_lat != 0.0 || target_lon != 0.0) {
            GuidanceComputer gc(MU_EARTH, RE, 150.0, 2e-12, 8.5, 2.2, 0.01);
            double earth_rotation_rate = 7.2921159e-5; // rad/s
            vector<Vector3d> path = gc.find_landing_trajectory(
                Vector3d(rx, ry, rz), 
                Vector3d::Zero(), 
                target_lat, 
                target_lon, 
                earth_rotation_rate
            );
            
            cout << "[";
            int step = max(1, (int)path.size() / 500); // limit to max 500 steps
            bool first = true;
            for (size_t i = 0; i < path.size(); i += step) {
                if (!first) cout << ",";
                cout << "[" << path[i].x() << "," << path[i].y() << "," << path[i].z() << "]";
                first = false;
            }
            if (path.size() > 0 && (path.size() - 1) % step != 0) {
                const auto& last = path.back();
                cout << ",[" << last.x() << "," << last.y() << "," << last.z() << "]";
            }
            cout << "]" << endl;
            return 0;
        }
    }

    double t = 0.0;
    double dt = preview_mode ? 100.0 : 0.5;

    if (preview_mode) {
        cout << "[";
        for (int i = 0; i < 8640; ++i) { // 10 days at 100s steps
            step_rk4(state, t, dt, nbody_enabled);
            cout << "[" << state(0) << "," << state(1) << "," << state(2) << "]";
            if (i < 8639) cout << ",";
        }
        cout << "]" << endl;
        return 0;
    }

    while (true) {
        step_rk4(state, t, dt, nbody_enabled);
        double altitude = state.segment<3>(0).norm() - RE;

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
