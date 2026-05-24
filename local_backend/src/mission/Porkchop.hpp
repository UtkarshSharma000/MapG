#pragma once
#include <vector>
#include <Eigen/Dense>

namespace Astro {

struct PorkchopPoint {
    double departure_jd;
    double arrival_jd;
    double dv;
};

class PorkchopGenerator {
public:
    static std::vector<PorkchopPoint> generate(
        int departure_body_id,
        int arrival_body_id,
        double dep_start_jd,
        double dep_end_jd,
        double arr_start_jd,
        double arr_end_jd,
        int steps
    );
};

} // namespace Astro
