#pragma once

#include <Eigen/Dense>
#include <vector>

namespace Astro {

enum class LambertStatus {
    Success,
    MaxIterationsReached,
    SingularGeometry,
    InvalidTimeOfFlight,
    NoConvergence,
    NumericalFailure
};

struct LambertSolution {

    Eigen::Vector3d v1;
    Eigen::Vector3d v2;

    double a = 0.0;

    double transfer_angle = 0.0;

    double tof = 0.0;

    int revs = 0;

    double vinf_departure = 0.0;
    double vinf_arrival = 0.0;

    int iterations = 0;

    LambertStatus status = LambertStatus::Success;
};

class LambertSolver {
public:

    static std::vector<LambertSolution> solve(
        const Eigen::Vector3d& r1,
        const Eigen::Vector3d& r2,
        double tof,
        double mu,
        bool prograde = true,
        int max_revs = 0
    );

private:

    static double stumpff_C(double z);

    static double stumpff_S(double z);

    static double compute_y(
        double z,
        double r1,
        double r2,
        double A
    );

    static double time_of_flight(
        double z,
        double r1,
        double r2,
        double A,
        double mu
    );
};

} // namespace Astro