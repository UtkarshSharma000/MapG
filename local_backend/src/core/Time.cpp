#include "Time.hpp"
#include <iostream>
extern "C" {
#include "SpiceUsr.h"
}

namespace Astro {

Epoch Epoch::fromUTC(const std::string& utcStr) {
    double tdb = 0.0;
    // SPICE str2et requires the LSK kernel to be loaded prior
    str2et_c(utcStr.c_str(), &tdb);
    if (failed_c()) {
        std::cerr << "CSPICE Error: Could not parse UTC string: " << utcStr << std::endl;
        reset_c();
    }
    return Epoch(tdb);
}

Epoch Epoch::fromTDB(double tdbSeconds) {
    return Epoch(tdbSeconds);
}

double Epoch::getMJD() const {
    return (tdb / 86400.0) + 51544.5;
}

} // namespace Astro
