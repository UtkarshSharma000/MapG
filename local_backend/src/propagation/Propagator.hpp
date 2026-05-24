#pragma once
#include <Eigen/Dense>
#include "core/Time.hpp"
#include "core/State.hpp"

namespace Astro {

class ForceModel {
public:
    virtual ~ForceModel() = default;
    virtual Eigen::Vector3d computeAcceleration(const Epoch& t, const StateVector& state) = 0;
};

class Integrator {
public:
    virtual ~Integrator() = default;
    virtual StateVector step(const StateVector& state, double& t, double& dt_advised) = 0;
};

class EventDetector {
public:
    virtual ~EventDetector() = default;
    virtual double g(const Epoch& t, const StateVector& state) = 0;
    virtual bool isTriggered() const = 0;
};

struct PropagationResult {
    std::vector<Epoch> timeHistory;
    std::vector<StateVector> stateHistory;
    std::string terminationReason;
};

} // namespace Astro
