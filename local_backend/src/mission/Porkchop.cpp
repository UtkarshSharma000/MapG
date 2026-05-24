#include "Porkchop.hpp"
#include "LambertIzzo.hpp"

#include <iostream>

namespace Astro {

constexpr double SECONDS_PER_DAY = 86400.0;

std::vector<PorkchopPoint>
PorkchopGenerator::generate(
        int departure_body_id,
        int arrival_body_id,
        double dep_start_jd,
        double dep_end_jd,
        double arr_start_jd,
        double arr_end_jd,
        int steps,
        double mu_central_body) {

    std::vector<PorkchopPoint> plot;

    if (steps < 2) {
        return plot;
    }

    double dep_step =
        (dep_end_jd - dep_start_jd) /
        (steps - 1);

    double arr_step =
        (arr_end_jd - arr_start_jd) /
        (steps - 1);

    for (int i = 0; i < steps; ++i) {

        double departure_jd =
            dep_start_jd +
            i * dep_step;

        State departure_state =
            Ephemeris::get_body_state(
                departure_body_id,
                departure_jd);

        for (int j = 0; j < steps; ++j) {

            double arrival_jd =
                arr_start_jd +
                j * arr_step;

            double tof_days =
                arrival_jd - departure_jd;

            if (tof_days <= 0.0)
                continue;

            double tof_sec =
                tof_days *
                SECONDS_PER_DAY;

            State arrival_state =
                Ephemeris::get_body_state(
                    arrival_body_id,
                    arrival_jd);

            auto sols =
                LambertSolver::solve(
                    departure_state.r,
                    arrival_state.r,
                    tof_sec,
                    mu_central_body);

            if (sols.empty())
                continue;

            const auto& sol = sols[0];

            Eigen::Vector3d vinf_dep =
                sol.v1 -
                departure_state.v;

            Eigen::Vector3d vinf_arr =
                sol.v2 -
                arrival_state.v;

            double dv_dep =
                vinf_dep.norm();

            double dv_arr =
                vinf_arr.norm();

            PorkchopPoint point;

            point.departure_jd =
                departure_jd;

            point.arrival_jd =
                arrival_jd;

            point.tof_days =
                tof_days;

            point.c3 =
                vinf_dep.squaredNorm();

            point.dv_departure =
                dv_dep;

            point.dv_arrival =
                dv_arr;

            point.dv_total =
                dv_dep + dv_arr;

            plot.push_back(point);
        }
    }

    return plot;
}

} // namespace Astro