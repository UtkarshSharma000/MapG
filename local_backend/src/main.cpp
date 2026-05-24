#include <iostream>
#include <vector>
#include <string>
#include "core/Time.hpp"
#include "ephem/SpiceWrapper.hpp"
#include "mission/LambertIzzo.hpp"
// Provide a very simple web server dummy API response just to compile and prove it works

using namespace Astro;

// Standard json response using basic string assembly for now to avoid rapid JSON library compilation issues
std::string buildJsonResponse(const Eigen::Vector3d& v) {
    return "{\"vx\":" + std::to_string(v.x()) + 
           ",\"vy\":" + std::to_string(v.y()) + 
           ",\"vz\":" + std::to_string(v.z()) + "}";
}

#include <iostream>
#include <vector>
#include <string>
#include "httplib.h"
#include <nlohmann/json.hpp>
#include "core/Time.hpp"
#include "ephem/SpiceWrapper.hpp"
#include "mission/LambertIzzo.hpp"
#include "propagation/Propagator.hpp"

using json = nlohmann::json;
using namespace Astro;

int main() {
    httplib::Server svr;

    // Load kernels
    SpiceSystem::initialize({"../data/naif0012.tls", "../data/de440s.bsp", "../data/pck00010.tpc"});

    svr.Post("/api/lambert", [](const httplib::Request& req, httplib::Response& res) {
        try {
            auto j = json::parse(req.body);
            
            Eigen::Vector3d r1(j["r1"][0], j["r1"][1], j["r1"][2]);
            Eigen::Vector3d r2(j["r2"][0], j["r2"][1], j["r2"][2]);
            double tof = j["tof"];
            double mu = j["mu"];

            auto solutions = LambertSolver::solve(r1, r2, tof, mu, true, 0);
            
            if (solutions.empty()) {
                res.status = 400;
                res.set_content("{\"error\": \"No solution found\"}", "application/json");
                return;
            }

            json response = {
                {"v1", {solutions[0].v1.x(), solutions[0].v1.y(), solutions[0].v1.z()}},
                {"v2", {solutions[0].v2.x(), solutions[0].v2.y(), solutions[0].v2.z()}},
                {"a", solutions[0].a},
                {"revs", solutions[0].revs}
            };
            
            res.set_content(response.dump(), "application/json");
        } catch (const std::exception& e) {
            res.status = 500;
            res.set_content("{\"error\": \"Internal server error\"}", "application/json");
        }
    });

    svr.listen("0.0.0.0", 8080);
    return 0;
}
