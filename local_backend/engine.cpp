#include <iostream>
#include <vector>
#include <cmath>
#include <memory>
#include <chrono>
#include <thread>
#include <iomanip>
#include <Eigen/Dense>

using namespace std;
using namespace Eigen;

// ----- Constants -----
const double MU = 398600.4418;  // Earth's gravitational constant (km^3/s^2)
const double Re = 6378.137;     // Earth's equatorial radius (km)
const double J2 = 1.08262668e-3;// J2 perturbation coefficient
const double OMEGA_E = 7.2921159e-5; // Earth's rotation rate (rad/s)

// Atmospheric Drag Constants
const double rho0 = 2e-12; // Reference density at h0 (kg/m^3)
const double h0 = 150.0;   // Reference altitude (km)
const double H = 8.5;      // Scale height (km)
const double Cd = 2.2;     // Drag coefficient
const double A_m = 0.01;   // Area-to-mass ratio (m^2/kg)

// Ground Station: Delhi
const double DELHI_LAT = 28.61 * M_PI / 180.0;
const double DELHI_LON = 77.21 * M_PI / 180.0;

// ----- State Vector: [rx, ry, rz, vx, vy, vz] (km, km/s) -----
using StateVector = Matrix<double, 6, 1>;

class OrbitalEngine {
public:
    OrbitalEngine() : currentTime(0.0) {}

    // Computes derivatives: X_dot = F(X, t)
    StateVector computeDerivatives(const StateVector& state, double t) {
        Vector3d r_vec = state.segment<3>(0);
        Vector3d v_vec = state.segment<3>(3);
        
        double r = r_vec.norm();
        double r2 = r * r;
        double r3 = r2 * r;
        double z2 = r_vec(2) * r_vec(2);

        // Point mass gravity
        Vector3d a_grav = -MU / r3 * r_vec;

        // J2 Perturbation
        double j2_factor = -1.5 * J2 * MU * (Re * Re) / (r * r2 * r2);
        Vector3d a_j2;
        a_j2(0) = j2_factor * r_vec(0) * (1.0 - 5.0 * z2 / r2);
        a_j2(1) = j2_factor * r_vec(1) * (1.0 - 5.0 * z2 / r2);
        a_j2(2) = j2_factor * r_vec(2) * (3.0 - 5.0 * z2 / r2);

        // Atmospheric Drag
        Vector3d a_drag = Vector3d::Zero();
        double altitude = r - Re;
        if (altitude < 150.0) {
            double rho = rho0 * exp(-(altitude - h0) / H);
            
            // Atmospheric velocity relative to rotating Earth
            Vector3d v_atm;
            v_atm(0) = v_vec(0) + OMEGA_E * r_vec(1);
            v_atm(1) = v_vec(1) - OMEGA_E * r_vec(0);
            v_atm(2) = v_vec(2);
            
            double v_rel_mag = v_atm.norm();
            
            // drag accel in km/s^2
            // A_m is in m^2/kg, rho in kg/m^3 -> needs conversion factor of 1000 for consistent km units
            a_drag = -0.5 * Cd * A_m * rho * 1000.0 * v_rel_mag * v_atm;
        }

        Vector3d a_total = a_grav + a_j2 + a_drag;

        StateVector d_state;
        d_state.segment<3>(0) = v_vec;
        d_state.segment<3>(3) = a_total;

        return d_state;
    }

    void stepRK4(StateVector& state, double dt) {
        StateVector k1 = computeDerivatives(state, currentTime);
        StateVector k2 = computeDerivatives(state + 0.5 * dt * k1, currentTime + 0.5 * dt);
        StateVector k3 = computeDerivatives(state + 0.5 * dt * k2, currentTime + 0.5 * dt);
        StateVector k4 = computeDerivatives(state + dt * k3, currentTime + dt);

        state += (dt / 6.0) * (k1 + 2.0 * k2 + 2.0 * k3 + k4);
        currentTime += dt;
    }

    void calculateGroundStationTelemetry(const StateVector& state, double& slantRange, double& elevation) {
        Vector3d r_eci = state.segment<3>(0);
        
        // ECI to ECEF (simplified rotation)
        double theta = OMEGA_E * currentTime;
        double cos_t = cos(theta);
        double sin_t = sin(theta);
        
        Vector3d r_ecef;
        r_ecef(0) = r_eci(0) * cos_t + r_eci(1) * sin_t;
        r_ecef(1) = -r_eci(0) * sin_t + r_eci(1) * cos_t;
        r_ecef(2) = r_eci(2);

        // Ground station ECEF
        Vector3d r_gs;
        r_gs(0) = Re * cos(DELHI_LAT) * cos(DELHI_LON);
        r_gs(1) = Re * cos(DELHI_LAT) * sin(DELHI_LON);
        r_gs(2) = Re * sin(DELHI_LAT);

        // Vector from GS to satellite in ECEF
        Vector3d dr = r_ecef - r_gs;
        slantRange = dr.norm();

        // ECEF to ENU
        double clat = cos(DELHI_LAT);
        double slat = sin(DELHI_LAT);
        double clon = cos(DELHI_LON);
        double slon = sin(DELHI_LON);
        
        double up = clat * clon * dr(0) + clat * slon * dr(1) + slat * dr(2);
        
        elevation = asin(up / slantRange) * 180.0 / M_PI;
    }

    double currentTime;
};

int main() {
    unique_ptr<OrbitalEngine> engine = make_unique<OrbitalEngine>();

    // Initial state: LEO approx 400km altitude
    StateVector state;
    // Circular velocity ~ 7.67 km/s
    state << Re + 400.0, 0, 0,  
             0, 7.67, 1.0; 

    double dt = 0.5; // Physics step size in seconds

    while (true) {
        // Run physics integration for 0.5 simulation seconds
        engine->stepRK4(state, dt);

        double slantRange, elevation;
        engine->calculateGroundStationTelemetry(state, slantRange, elevation);

        // Output JSON telemetry
        cout << "{"
             << "\"time\":" << engine->currentTime << ","
             << "\"x\":" << state(0) << ","
             << "\"y\":" << state(1) << ","
             << "\"z\":" << state(2) << ","
             << "\"vx\":" << state(3) << ","
             << "\"vy\":" << state(4) << ","
             << "\"vz\":" << state(5) << ","
             << "\"delhi_range_km\":" << slantRange << ","
             << "\"delhi_elevation_deg\":" << elevation
             << "}" << endl;

        // Real-time synchronization
        this_thread::sleep_for(chrono::milliseconds(500));
    }

    return 0;
}
