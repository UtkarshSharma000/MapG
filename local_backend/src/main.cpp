#include <iostream>
#include <vector>
#include <string>
#include <exception>

#include "httplib.h"
#include <nlohmann/json.hpp>
#include <Eigen/Dense>

#include "core/Time.hpp"
#include "ephem/SpiceWrapper.hpp"
#include "mission/LambertIzzo.hpp"
#include "mission/Porkchop.hpp"
#include "propagation/Propagator.hpp"

using json = nlohmann::json;

using namespace Astro;

namespace {

constexpr double MU_SUN = 132712440018.0; // km^3/s^2

bool validate_vector3(const json& arr) {
    return arr.is_array()
        && arr.size() == 3
        && arr[0].is_number()
        && arr[1].is_number()
        && arr[2].is_number();
}

json vector_to_json(const Eigen::Vector3d& v) {
    return json::array({v.x(), v.y(), v.z()});
}

void add_cors_headers(httplib::Response& res) {
    res.set_header("Access-Control-Allow-Origin", "*");
    res.set_header("Access-Control-Allow-Headers", "*");
    res.set_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
}

} // anonymous namespace

int main() {

    try {

        // Initialize SPICE
        SpiceSystem::initialize({
            "../data/naif0012.tls",
            "../data/de440s.bsp",
            "../data/pck00010.tpc"
        });

        std::cout << "SPICE initialized.\n";

    } catch (const std::exception& e) {

        std::cerr << "Failed to initialize SPICE: "
                  << e.what() << "\n";

        return EXIT_FAILURE;
    }

    httplib::Server svr;

    svr.new_task_queue = [] {
        return new httplib::ThreadPool(8);
    };

    // OPTIONS handler for CORS
    svr.Options(R"(.*)", [](const httplib::Request&,
                            httplib::Response& res) {

        add_cors_headers(res);
    });

    // =========================================================
    // Lambert Endpoint
    // =========================================================

    svr.Post("/api/lambert",
        [](const httplib::Request& req,
           httplib::Response& res) {

        add_cors_headers(res);

        try {

            auto j = json::parse(req.body);

            if (!j.contains("r1") ||
                !j.contains("r2") ||
                !j.contains("tof") ||
                !j.contains("mu")) {

                res.status = 400;

                res.set_content(
                    R"({"error":"Missing required fields"})",
                    "application/json");

                return;
            }

            if (!validate_vector3(j["r1"]) ||
                !validate_vector3(j["r2"])) {

                res.status = 400;

                res.set_content(
                    R"({"error":"Invalid vector format"})",
                    "application/json");

                return;
            }

            Eigen::Vector3d r1(
                j["r1"][0],
                j["r1"][1],
                j["r1"][2]);

            Eigen::Vector3d r2(
                j["r2"][0],
                j["r2"][1],
                j["r2"][2]);

            double tof = j["tof"];
            double mu = j["mu"];

            bool prograde =
                j.value("prograde", true);

            int max_revs =
                j.value("max_revs", 0);

            auto solutions =
                LambertSolver::solve(
                    r1,
                    r2,
                    tof,
                    mu,
                    prograde,
                    max_revs);

            if (solutions.empty()) {

                res.status = 400;

                res.set_content(
                    R"({"error":"No Lambert solution found"})",
                    "application/json");

                return;
            }

            const auto& sol = solutions[0];

            json response = {

                {"success", true},

                {"solution", {

                    {"v1", vector_to_json(sol.v1)},
                    {"v2", vector_to_json(sol.v2)},

                    {"a", sol.a},
                    {"tof", sol.tof},

                    {"transfer_angle",
                        sol.transfer_angle},

                    {"revs", sol.revs},

                    {"iterations",
                        sol.iterations}
                }}
            };

            res.set_content(
                response.dump(4),
                "application/json");

        } catch (const json::exception& e) {

            res.status = 400;

            json err = {
                {"success", false},
                {"error", "Invalid JSON"},
                {"details", e.what()}
            };

            res.set_content(
                err.dump(4),
                "application/json");

        } catch (const std::exception& e) {

            res.status = 500;

            json err = {
                {"success", false},
                {"error", "Internal server error"},
                {"details", e.what()}
            };

            res.set_content(
                err.dump(4),
                "application/json");
        }
    });

    // =========================================================
    // Porkchop Endpoint
    // =========================================================

    svr.Post("/api/porkchop",
        [](const httplib::Request& req,
           httplib::Response& res) {

        add_cors_headers(res);

        try {

            auto j = json::parse(req.body);

            int departure_body =
                j["departure_body"];

            int arrival_body =
                j["arrival_body"];

            double dep_start =
                j["dep_start_jd"];

            double dep_end =
                j["dep_end_jd"];

            double arr_start =
                j["arr_start_jd"];

            double arr_end =
                j["arr_end_jd"];

            int steps =
                j.value("steps", 50);

            auto plot =
                PorkchopGenerator::generate(
                    departure_body,
                    arrival_body,
                    dep_start,
                    dep_end,
                    arr_start,
                    arr_end,
                    steps,
                    MU_SUN);

            json response;

            response["success"] = true;

            for (const auto& p : plot) {

                response["points"].push_back({

                    {"departure_jd",
                        p.departure_jd},

                    {"arrival_jd",
                        p.arrival_jd},

                    {"tof_days",
                        p.tof_days},

                    {"c3",
                        p.c3},

                    {"dv_departure",
                        p.dv_departure},

                    {"dv_arrival",
                        p.dv_arrival},

                    {"dv_total",
                        p.dv_total}
                });
            }

            res.set_content(
                response.dump(2),
                "application/json");

        } catch (const std::exception& e) {

            res.status = 500;

            json err = {
                {"success", false},
                {"error", e.what()}
            };

            res.set_content(
                err.dump(4),
                "application/json");
        }
    });

    // =========================================================
    // Start Server
    // =========================================================

    std::cout << "Astrodynamics server listening on port 8080\n";

    svr.listen("0.0.0.0", 8080);

    SpiceSystem::shutdown();

    return EXIT_SUCCESS;
}