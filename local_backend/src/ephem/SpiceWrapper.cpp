#include "SpiceWrapper.hpp"
#include <iostream>
extern "C" {
#include "SpiceUsr.h"
}

namespace Astro {

void SpiceSystem::initialize(const std::vector<std::string>& kernels) {
    // Need to clear any previous kernels before loading new ones
    kclear_c();
    
    // Set SPICE to not abort on error automatically so we can handle it
    erract_c("SET", 0, (char*)"RETURN"); 
    
    for (const auto& k : kernels) {
        furnsh_c(k.c_str());
        if (failed_c()) {
            char errmsg[1800];
            getmsg_c("LONG", 1800, errmsg);
            std::cerr << "CSPICE Error loading kernel '" << k << "': " << errmsg << std::endl;
            reset_c();
        }
    }
}

void SpiceSystem::clear() {
    kclear_c();
}

StateVector SpiceSystem::getState(const std::string& target, 
                                  const Epoch& epoch, 
                                  const std::string& frame, 
                                  const std::string& observer) {
    double state[6] = {0};
    double lt;
    
    spkezr_c(target.c_str(), epoch.getTDB(), frame.c_str(), "NONE", observer.c_str(), state, &lt);
    
    StateVector sv;
    if (failed_c()) {
        char errmsg[1800];
        getmsg_c("LONG", 1800, errmsg);
        std::cerr << "CSPICE Error spkezr_c for " << target << " relative to " << observer << ": " << errmsg << std::endl;
        reset_c();
        sv.setZero();
        return sv;
    }
    
    for(int i=0; i<6; ++i) sv(i) = state[i];
    return sv;
}

double SpiceSystem::getMu(const std::string& body) {
    SpiceInt dim;
    double mu = 0.0;
    
    // PCK kernel must be loaded. Use "GM" property
    bodvrd_c(body.c_str(), "GM", 1, &dim, &mu);
    
    if (failed_c()) {
        char errmsg[1800];
        getmsg_c("LONG", 1800, errmsg);
        std::cerr << "CSPICE Error bodvrd_c for GM of " << body << ": " << errmsg << std::endl;
        reset_c();
        return 398600.4418; // Fallback to Earth in km^3/s^2
    }
    
    return mu; // Return in km^3/s^2 as CSPICE native units
}

} // namespace Astro
