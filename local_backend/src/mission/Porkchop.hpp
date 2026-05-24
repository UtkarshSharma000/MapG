#pragma once

#include <vector>
#include <Eigen/Dense>

namespace Astro {

struct PorkchopPoint {

    double departure_jd;
    double arrival_jd;

    double tof_days;

    double c3;

    double dv_departure;
    double dv_arrival;
    double dv_total;
};

struct State {

    Eigen::Vector3d r;
    Eigen::Vector3d v;
};

class Ephemeris {
public:

    static State get_body_state(
        int body_id,
        double jd
    );
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
        int steps,
        double mu_central_body
    );
};

} // namespace Astro