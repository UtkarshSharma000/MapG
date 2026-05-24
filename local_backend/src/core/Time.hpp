#pragma once

#include <string>

namespace Astro {

class Epoch {
public:

    // Construct from UTC calendar string
    static Epoch fromUTC(const std::string& utcStr);

    // Construct directly from TDB seconds past J2000
    static Epoch fromTDB(double tdbSeconds);

    // TDB seconds past J2000
    double getTDB() const {
        return tdb;
    }

    // Julian Date (TDB)
    double getJDTDB() const;

    // Modified Julian Date (TDB)
    double getMJDTDB() const;

    // Time arithmetic
    Epoch operator+(double seconds) const;

    double operator-(const Epoch& other) const;

    // Comparisons
    bool operator<(const Epoch& other) const;

    bool operator>(const Epoch& other) const;

    bool operator==(const Epoch& other) const;

private:

    explicit Epoch(double tdb_sec)
        : tdb(tdb_sec) {}

    // Seconds past J2000 TDB
    double tdb;
};

} // namespace Astro