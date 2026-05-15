#pragma once
#include <Eigen/Dense>
#include <vector>
#include <cmath>
#include <iostream>

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
};
