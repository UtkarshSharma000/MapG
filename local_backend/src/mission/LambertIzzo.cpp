#include "LambertIzzo.hpp"

#include <Eigen/Dense>
#include <cmath>
#include <iostream>
#include <limits>
#include <vector>

namespace Astro {

namespace {

constexpr double PI = 3.14159265358979323846;
constexpr double TOL = 1e-8;
constexpr int MAX_ITER = 1000;

}

double LambertSolver::stumpff_C(double z) {

    if (z > 0.0) {

        double sz = std::sqrt(z);

        return (1.0 - std::cos(sz)) / z;
    }
    else if (z < 0.0) {

        double sz = std::sqrt(-z);

        return (std::cosh(sz) - 1.0) / (-z);
    }

    return 0.5;
}

double LambertSolver::stumpff_S(double z) {

    if (z > 0.0) {

        double sz = std::sqrt(z);

        return (sz - std::sin(sz)) /
               (sz * sz * sz);
    }
    else if (z < 0.0) {

        double sz = std::sqrt(-z);

        return (std::sinh(sz) - sz) /
               (sz * sz * sz);
    }

    return 1.0 / 6.0;
}

double LambertSolver::compute_y(
        double z,
        double r1,
        double r2,
        double A) {

    double C = stumpff_C(z);
    double S = stumpff_S(z);

    return r1 + r2 +
           A * ((z * S - 1.0) / std::sqrt(C));
}

double LambertSolver::time_of_flight(
        double z,
        double r1,
        double r2,
        double A,
        double mu) {

    double C = stumpff_C(z);
    double S = stumpff_S(z);

    double y = compute_y(z, r1, r2, A);

    if (y < 0.0)
        return std::numeric_limits<double>::infinity();

    double x = std::sqrt(y / C);

    return (x * x * x * S +
            A * std::sqrt(y)) /
           std::sqrt(mu);
}

std::vector<LambertSolution> LambertSolver::solve(
        const Eigen::Vector3d& r1_vec,
        const Eigen::Vector3d& r2_vec,
        double tof,
        double mu,
        bool prograde,
        int max_revs) {

    std::vector<LambertSolution> solutions;

    if (max_revs > 0) {
        std::cerr << "Multi-revolution not implemented.\n";
    }

    double r1 = r1_vec.norm();
    double r2 = r2_vec.norm();

    double cos_dtheta =
        r1_vec.dot(r2_vec) / (r1 * r2);

    cos_dtheta =
        std::clamp(cos_dtheta, -1.0, 1.0);

    Eigen::Vector3d cross =
        r1_vec.cross(r2_vec);

    double sin_dtheta =
        cross.norm() / (r1 * r2);

    if (prograde) {

        if (cross.z() < 0.0)
            sin_dtheta = -sin_dtheta;
    }
    else {

        if (cross.z() >= 0.0)
            sin_dtheta = -sin_dtheta;
    }

    double dtheta =
        std::atan2(sin_dtheta, cos_dtheta);

    if (dtheta < 0.0)
        dtheta += 2.0 * PI;

    if (std::abs(sin_dtheta) < 1e-10) {
        return solutions;
    }

    double A =
        sin_dtheta *
        std::sqrt(r1 * r2 /
        (1.0 - cos_dtheta));

    if (std::abs(A) < 1e-12) {
        return solutions;
    }

    double z = 0.0;

    int iter = 0;

    while (iter < MAX_ITER) {

        double dt =
            time_of_flight(
                z,
                r1,
                r2,
                A,
                mu);

        double F = dt - tof;

        if (std::abs(F) < TOL)
            break;

        double dz = 1e-5;

        double dt_p =
            time_of_flight(
                z + dz,
                r1,
                r2,
                A,
                mu);

        double dt_m =
            time_of_flight(
                z - dz,
                r1,
                r2,
                A,
                mu);

        double dFdz =
            (dt_p - dt_m) /
            (2.0 * dz);

        if (std::abs(dFdz) < 1e-12) {
            return solutions;
        }

        z -= F / dFdz;

        iter++;
    }

    double y =
        compute_y(z, r1, r2, A);

    double f = 1.0 - y / r1;

    double g =
        A * std::sqrt(y / mu);

    double gdot =
        1.0 - y / r2;

    if (std::abs(g) < 1e-12) {
        return solutions;
    }

    Eigen::Vector3d v1 =
        (r2_vec - f * r1_vec) / g;

    Eigen::Vector3d v2 =
        (gdot * r2_vec - r1_vec) / g;

    double energy =
        v1.squaredNorm() / 2.0 -
        mu / r1;

    double a =
        -mu / (2.0 * energy);

    LambertSolution sol;

    sol.v1 = v1;
    sol.v2 = v2;

    sol.a = a;

    sol.transfer_angle = dtheta;

    sol.tof = tof;

    sol.revs = 0;

    sol.iterations = iter;

    sol.status = LambertStatus::Success;

    solutions.push_back(sol);

    return solutions;
}

} // namespace Astro