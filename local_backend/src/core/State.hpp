#pragma once

#include <Eigen/Dense>

namespace Astro {

// Cartesian inertial state vector:
//
// [0:2] = position [km]
// [3:5] = velocity [km/s]
//
using StateVector = Eigen::Matrix<double, 6, 1>;

} // namespace Astro