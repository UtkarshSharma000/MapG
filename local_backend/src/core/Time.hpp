#pragma once
#include <string>

namespace Astro {

class Epoch {
public:
    static Epoch fromUTC(const std::string& utcStr);
    static Epoch fromTDB(double tdbSeconds);

    double getTDB() const { return tdb; }
    double getMJD() const;

    Epoch operator+(double seconds) const { return Epoch(tdb + seconds); }

private:
    explicit Epoch(double tdb_sec) : tdb(tdb_sec) {}
    double tdb;
};

} // namespace Astro
