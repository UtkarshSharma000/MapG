#include "Propagator.hpp"
#include <memory>
#include <vector>

namespace Astro {

class Propagator {
public:
    Propagator(std::shared_ptr<ForceModel> forceModel);

    PropagationResult propagate(
        const StateVector& initialState,
        const Epoch& startEpoch,
        double maxDuration,
        double initialStep = 60.0
    ) {
        PropagationResult res;
        res.timeHistory.push_back(startEpoch);
        res.stateHistory.push_back(initialState);
        res.terminationReason = "MaxDurationReached";
        return res;
    }

    void addEventDetector(std::shared_ptr<EventDetector> detector) {
        events.push_back(detector);
    }

private:
    std::shared_ptr<ForceModel> forces;
    std::vector<std::shared_ptr<EventDetector>> events;
    std::shared_ptr<Integrator> integrator; 
};

Propagator::Propagator(std::shared_ptr<ForceModel> forceModel) 
    : forces(forceModel) {}

} // namespace Astro
