#include "Time.hpp"

#include <stdexcept>

extern "C" {
#include "SpiceUsr.h"
}

namespace Astro {

Epoch Epoch::fromUTC(const std::string& utcStr) {

    double et = 0.0;

    str2et_c(utcStr.c_str(), &et);

    if (failed_c()) {

        SpiceChar msg[1841];

        getmsg_c("LONG", sizeof(msg), msg);

        reset_c();

        throw std::runtime_error(
            std::string("SPICE str2et_c failed: ") + msg
        );
    }

    return Epoch(et);
}

Epoch Epoch::fromTDB(double tdbSeconds) {
    return Epoch(tdbSeconds);
}

double Epoch::getJDTDB() const {

    constexpr double JD_J2000 = 2451545.0;

    return JD_J2000 + (tdb / 86400.0);
}

double Epoch::getMJDTDB() const {

    constexpr double MJD_J2000 = 51544.5;

    return MJD_J2000 + (tdb / 86400.0);
}

Epoch Epoch::operator+(double seconds) const {
    return Epoch(tdb + seconds);
}

double Epoch::operator-(const Epoch& other) const {
    return tdb - other.tdb;
}

bool Epoch::operator<(const Epoch& other) const {
    return tdb < other.tdb;
}

bool Epoch::operator>(const Epoch& other) const {
    return tdb > other.tdb;
}

bool Epoch::operator==(const Epoch& other) const {
    return tdb == other.tdb;
}

} // namespace Astro