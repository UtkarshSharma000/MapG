#pragma once
#include <Eigen/Dense>
#include <vector>

namespace Astro {

struct LambertSolution {
    Eigen::Vector3d v1;
    Eigen::Vector3d v2;
    double a;
    int revs;
};

class LambertSolver {
public:
    static std::vector<LambertSolution> solve(
        const Eigen::Vector3d& r1, 
        const Eigen::Vector3d& r2, 
        double tof_seconds, 
        double mu, 
        bool prograde = true,
        int max_revs = 0
    );
};

} // namespace Astro
