#pragma once

#include "core/Time.hpp"
#include "core/State.hpp"

#include <string>
#include <vector>

namespace Astro {

class SpiceSystem {
public:

    static void initialize(const std::vector<std::string>& kernels);

    static void clear();

    // SPICE state retrieval (km, km/s)
    static StateVector getState(
        const std::string& target,
        const Epoch& epoch,
        const std::string& frame = "J2000",
        const std::string& observer = "SUN"
    );

    // Gravitational parameter (km^3/s^2)
    static double getMu(const std::string& body);

    // Optional safety check
    static bool isLoaded();

private:
    static bool loaded;
};

} // namespace Astro