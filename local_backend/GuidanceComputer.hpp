#define _USE_MATH_DEFINES  // Must be at the very top!
#include <cmath>
#include <iostream>
#include <vector>
#pragma once
#include <Eigen/Dense>

using namespace Eigen;
using namespace std;

// This class predicts and optimizes the path of a space shuttle targeting a specific planetary landing zone.
class GuidanceComputer {
private:
    double mu;
    double R_planet;
    double atm_height;
    double rho0;
    double H_scale;
    double CD;
    double AM; // Area/Mass ratio

public:
    GuidanceComputer(double mu, double R_planet, double atm_height, double rho0, double H_scale, double CD, double AM)
        : mu(mu), R_planet(R_planet), atm_height(atm_height), rho0(rho0), H_scale(H_scale), CD(CD), AM(AM) {}

    // Calculates atmospheric drag acceleration
    Vector3d calculate_drag(const Vector3d& pos, const Vector3d& vel) const {
        double r = pos.norm();
        double h = r - R_planet;
        if (h > 0 && h < atm_height) {
            double rho = rho0 * exp(-h / H_scale);
            double v = vel.norm();
            // F_D / m = -0.5 * rho * v^2 * C_D * A / m 
            // The velocity vector provides direction
            return -0.5 * rho * v * CD * AM * vel * 1000.0; // 1000.0 if using km for distances and want consistent units, depends on your units
        }
        return Vector3d::Zero();
    }

    // RK4 step for the prediction
    void rk4_step(Vector3d& pos, Vector3d& vel, double dt) const {
        auto get_derivative = [&](const Vector3d& p, const Vector3d& v) -> std::pair<Vector3d, Vector3d> {
            Vector3d a_grav = -mu / pow(p.norm(), 3) * p;
            Vector3d a_drag = calculate_drag(p, v);
            return {v, a_grav + a_drag};
        };

        auto k1 = get_derivative(pos, vel);
        auto k2 = get_derivative(pos + 0.5 * dt * k1.first, vel + 0.5 * dt * k1.second);
        auto k3 = get_derivative(pos + 0.5 * dt * k2.first, vel + 0.5 * dt * k2.second);
        auto k4 = get_derivative(pos + dt * k3.first, vel + dt * k3.second);

        pos += (dt / 6.0) * (k1.first + 2.0 * k2.first + 2.0 * k3.first + k4.first);
        vel += (dt / 6.0) * (k1.second + 2.0 * k2.second + 2.0 * k3.second + k4.second);
    }

    // Evaluate trajectory
    // Simulates the trajectory until impact (h <= 0) or maximum steps
    // Returns final position and the path taken.
    std::pair<Vector3d, std::vector<Vector3d>> simulate_trajectory(Vector3d start_pos, Vector3d initial_vel, double dt = 1.0, int max_steps = 10000) const {
        Vector3d pos = start_pos;
        Vector3d vel = initial_vel;
        std::vector<Vector3d> path;
        path.push_back(pos);

        for (int i = 0; i < max_steps; ++i) {
            rk4_step(pos, vel, dt);
            path.push_back(pos);
            if (pos.norm() <= R_planet) {
                break;
            }
            if (pos.norm() > R_planet * 50) { // Escaped
                break;
            }
        }
        return {pos, path};
    }

    // "Shooting Method" Pathfinder using Newton-Raphson / Gradient Descent approach
    std::vector<Vector3d> find_landing_trajectory(
        Vector3d start_pos, 
        Vector3d target_planet_center, // normally zero if simulator is planet-centric
        double target_lat, 
        double target_lon, 
        double planet_rotation_rate) const 
    {
        // 1. Initial guess for velocity (e.g., retro-burn)
        Vector3d v_guess = -start_pos.normalized() * sqrt(mu / start_pos.norm()) * 0.5; // slow down to drop orbit

        double dt = 2.0; 
        int max_iters = 20;
        double delta_v = 1e-4; // Step size for numerical gradient

        for (int iter = 0; iter < max_iters; ++iter) {
            auto [final_pos, path] = simulate_trajectory(start_pos, v_guess, dt);
            
            // Calculate time of flight
            double tof = path.size() * dt;
            
            // Expected target position after rotation
            // target_lon increases by rotation_rate * tof
            double eq_lat = target_lat * M_PI / 180.0;
            double eq_lon = target_lon * M_PI / 180.0 + planet_rotation_rate * tof;
            
            Vector3d target_pos(
                R_planet * cos(eq_lat) * cos(eq_lon),
                R_planet * cos(eq_lat) * sin(eq_lon),
                R_planet * sin(eq_lat)
            );
            target_pos += target_planet_center;

            if ((final_pos - target_pos).norm() < 10.0 || final_pos.norm() > R_planet * 1.5) { 
                // Close enough or missed planet completely (we should handle miss carefully, but let's just return path)
                if (final_pos.norm() <= R_planet * 1.05) {
                    return path;
                }
            }

            Vector3d error = final_pos - target_pos;

            // Numerically estimate Jacobian J = d(final_pos) / d(v_guess)
            Matrix3d J;
            for (int i = 0; i < 3; ++i) {
                Vector3d dv = Vector3d::Zero();
                dv[i] = delta_v;
                auto [fpos, _] = simulate_trajectory(start_pos, v_guess + dv, dt);
                Vector3d d_error = fpos - target_pos;
                J.col(i) = (d_error - error) / delta_v;
            }

            // Correct guess: v_new = v_guess - J^-1 * error
            // Using SVD for robust inversion instead of straight inverse
            JacobiSVD<Matrix3d> svd(J, ComputeFullU | ComputeFullV);
            v_guess -= svd.solve(error) * 0.5; // step size 0.5 for stability
        }

        auto [final_pos, path] = simulate_trajectory(start_pos, v_guess, dt);
        return path;
    }

    // --- Phase Angle Logic ---
    // Returns the required relative angle (in radians) between planets for a Hohmann transfer window
    double calculate_launch_window(double r1_orbit_radius, double r2_orbit_radius, double mu_sun) const {
        double a_transfer = (r1_orbit_radius + r2_orbit_radius) / 2.0;
        double tof = M_PI * sqrt(pow(a_transfer, 3) / mu_sun);
        double omega_target = sqrt(mu_sun / pow(r2_orbit_radius, 3));
        double alpha = omega_target * tof;
        return M_PI - alpha; // Required phase angle just before launch
    }

    // --- Universal Variable Lambert Solver ---
    // Universal Variable helper functions
    double C(double z) const {
        if (z > 1e-6) return (1.0 - cos(sqrt(z))) / z;
        if (z < -1e-6) return (cosh(sqrt(-z)) - 1.0) / (-z);
        return 1.0 / 2.0 - z / 24.0 + (z * z) / 720.0;
    }

    double S(double z) const {
        if (z > 1e-6) return (sqrt(z) - sin(sqrt(z))) / pow(sqrt(z), 3);
        if (z < -1e-6) return (sinh(sqrt(-z)) - sqrt(-z)) / pow(sqrt(-z), 3);
        return 1.0 / 6.0 - z / 120.0 + (z * z) / 5040.0;
    }

    // Solves for required initial velocity vector
    std::pair<Vector3d, Vector3d> solve_lambert_full(const Vector3d& r1, const Vector3d& r2, double tof, double mu_sun, bool prograde = true) const {
        double norm1 = r1.norm();
        double norm2 = r2.norm();
        
        double cosDnu = r1.dot(r2) / (norm1 * norm2);
        Vector3d cr = r1.cross(r2);
        double dnu = acos(max(-1.0, min(1.0, cosDnu)));
        
        if (prograde) {
            if (cr.z() < 0) dnu = 2.0 * M_PI - dnu;
        } else {
            if (cr.z() >= 0) dnu = 2.0 * M_PI - dnu;
        }
        
        double A = sin(dnu) * sqrt((norm1 * norm2) / (1.0 - cos(dnu)));
        
        double z = 0.0;
        double y = 0.0;
        double x = 0.0;
        double tCalc = 0.0;
        double zLow = -4.0 * M_PI * M_PI;
        double zHigh = 4.0 * M_PI * M_PI;
        
        for (int iter = 0; iter < 100; ++iter) {
            double cVal = C(z);
            double sVal = S(z);
            
            y = norm1 + norm2 - A * (1.0 - z * sVal) / sqrt(cVal);
            
            if (y < 0) {
                zLow = z;
                z = (z + zHigh) / 2.0;
                continue;
            }
            
            x = sqrt(y / cVal);
            tCalc = (pow(x, 3) * sVal + A * sqrt(y)) / sqrt(mu_sun);
            
            if (abs(tCalc - tof) < 1e-5) {
                break;
            }
            
            if (tCalc < tof) {
                zLow = z;
            } else {
                zHigh = z;
            }
            z = (zHigh + zLow) / 2.0;
        }
        
        double cVal = C(z);
        double sVal = S(z);
        
        double f = 1.0 - y / norm1;
        double g = A * sqrt(y / mu_sun);
        
        Vector3d v1 = (r2 - f * r1) / g;
        
        double f_dot = sqrt(mu_sun) / (norm1 * norm2) * sqrt(y / cVal) * (z * sVal - 1.0);
        double g_dot = 1.0 - y / norm2;
        
        Vector3d v2 = f_dot * r1 + g_dot * v1;
        
        return {v1, v2};
    }

    Vector3d solve_lambert(const Vector3d& r1, const Vector3d& r2, double tof, double mu_sun, bool prograde = true) const {
        return solve_lambert_full(r1, r2, tof, mu_sun, prograde).first;
    }

    // --- Dual-Mode Mission Solver ---
    // Mode A: Fuel-Optimal Hohmann transfer
    // Mode B: Time-Optimal specified Time-Of-Flight intercept
    Vector3d compute_transfer_velocity(const Vector3d& r1, const Vector3d& r2_target_raw, double target_tof_days, double mu_sun, bool is_hohmann) const {
        double target_tof_seconds = target_tof_days * 24.0 * 3600.0;
        if (is_hohmann) {
            // Mode A (Efficient)
            double a_transfer = (r1.norm() + r2_target_raw.norm()) / 2.0;
            double hohmann_tof = M_PI * sqrt(pow(a_transfer, 3) / mu_sun);
            return solve_lambert(r1, r2_target_raw, hohmann_tof, mu_sun);
        } else {
            // Mode B (Fast)
            return solve_lambert(r1, r2_target_raw, target_tof_seconds, mu_sun);
        }
    }

    // --- Code Integration: Ghost Path Rendering ---
    // Predicts the next 500 points for UI rendering using RK4
    std::vector<Vector3d> generate_ghost_path(const Vector3d& start_pos, const Vector3d& start_vel, double tof, double mu_sun, int num_points = 500) const {
        std::vector<Vector3d> path;
        path.reserve(num_points);
        
        double dt = tof / (num_points - 1);
        Vector3d pos = start_pos;
        Vector3d vel = start_vel;
        
        path.push_back(pos);
        
        auto get_derivative = [&](const Vector3d& p, const Vector3d& v) -> std::pair<Vector3d, Vector3d> {
            Vector3d a_grav = -mu_sun * p / pow(p.norm(), 3);
            return {v, a_grav};
        };
        
        for (int i = 1; i < num_points; ++i) {
            auto k1 = get_derivative(pos, vel);
            auto k2 = get_derivative(pos + 0.5 * dt * k1.first, vel + 0.5 * dt * k1.second);
            auto k3 = get_derivative(pos + 0.5 * dt * k2.first, vel + 0.5 * dt * k2.second);
            auto k4 = get_derivative(pos + dt * k3.first, vel + dt * k3.second);

            pos += (dt / 6.0) * (k1.first + 2.0 * k2.first + 2.0 * k3.first + k4.first);
            vel += (dt / 6.0) * (k1.second + 2.0 * k2.second + 2.0 * k3.second + k4.second);
            
            path.push_back(pos);
        }
        
        return path;
    }
};
