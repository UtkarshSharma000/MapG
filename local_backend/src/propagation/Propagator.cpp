#include "Propagator.hpp"
#include <cmath>

namespace Astro {

class RK4Integrator : public Integrator {
public:
    StateVector step(const StateVector& state, ForceModel& forces, double& t, double dt) {
        StateVector k1 = derivative(t, state, forces);
        StateVector k2 = derivative(t + dt/2.0, state + k1 * (dt/2.0), forces);
        StateVector k3 = derivative(t + dt/2.0, state + k2 * (dt/2.0), forces);
        StateVector k4 = derivative(t + dt, state + k3 * dt, forces);
        
        t += dt;
        return state + (k1 + k2 * 2.0 + k3 * 2.0 + k4) * (dt / 6.0);
    }
    
    // Simplified step signature for interface compliance
    StateVector step(const StateVector& state, double& t, double& dt_advised) override {
        // This needs a concrete force model
        return state; 
    }

private:
    StateVector derivative(double t, const StateVector& state, ForceModel& forces) {
        Eigen::Vector3d r = state.head<3>();
        Eigen::Vector3d v = state.tail<3>();
        Eigen::Vector3d a = forces.computeAcceleration(Epoch(t), state);
        
        StateVector d;
        d.head<3>() = v;
        d.tail<3>() = a;
        return d;
    }
};

} // namespace Astro
