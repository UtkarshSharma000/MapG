# Astrodynamics & Mission Design Engine Architecture

## 1. High-Level System Architecture

To transition from a simplistic visualizer backend to a professional-grade mission design tool (akin to GMAT, Orekit, or Tudat), the system must be strictly layered. 

1. **API / Middleware Layer**: Handles JSON serialization (nlohmann/json), REST/WebSocket endpoints (Crow/httplib), and input validation.
2. **Mission Layer**: Handles high-level trajectory planning, Lambert targeting, Porkchop plot generation, multiple gravity assist (MGA) sequence optimization, and differential correction.
3. **Propagation Layer**: Contains the numerical integrators (Dormand-Prince 8(5,3), RKF78), event detection systems (Brent's method for root-finding target planes or SOI crossings), and trajectory state histories.
4. **Dynamics & Environment Layer**: Implements force models (N-body gravity, J2/J3 harmonics, aerodynamic drag, SRP).
5. **Core Astrodynamics Layer**: Time systems (TDB, TT, UTC), Reference Frames (ICRF, body-fixed, VNC), and State representations.
6. **Data Layer**: NASA CSPICE toolkit wrappers for accurate planetary ephemerides, leap seconds (LSK), and planetary constants (PCK).

## 2. Recommended File Structure

```text
/backend
├── CMakeLists.txt
├── vcpkg.json                 # Dependency management (Eigen, CSPICE, nlohmann-json, GTest)
├── src/
│   ├── main.cpp               # API entry point
│   ├── api/                   # REST routing and JSON parsing
│   ├── core/
│   │   ├── Time.hpp/cpp       # Epochs, TDB/UTC conversions
│   │   ├── State.hpp/cpp      # Cartesian & Keplerian states
│   │   └── Frames.hpp/cpp     # Frame transformations
│   ├── ephem/
│   │   ├── SpiceWrapper.hpp/cpp # CSPICE initialization and lookups
│   │   └── Body.hpp/cpp       # Celestial body metadata
│   ├── math/
│   │   ├── Integrator.hpp     # Abstract integrator interface
│   │   ├── DormandPrince853.hpp # High-order adaptive RK
│   │   └── RootFitter.hpp     # Brent's method for event detection
│   ├── dynamics/
│   │   └── ForceModel.hpp/cpp # N-Body, J2, Drag evaluations
│   ├── propagation/
│   │   ├── Propagator.hpp/cpp # Cowell's formulation manager
│   │   └── Event.hpp/cpp      # SOI crossing, altitude limits
│   └── mission/
│       ├── LambertIzzo.hpp/cpp # Izzo's universal variable Lambert
│       ├── Porkchop.hpp/cpp   # Multithreaded contour generation
│       ├── BPlane.hpp/cpp     # Gravity assist targeting
│       └── Maneuver.hpp/cpp   # Impulsive finite burns
├── tests/
│   ├── test_propagation.cpp   # Validate against JPL Horizons
│   ├── test_lambert.cpp       # Validate multi-rev transfers
│   └── test_spice.cpp         # Validate epoch/position logic
└── data/                      # SPK, LSK, PCK kernels
```

## 3. Core Class Definitions & Header Skeletons

### `core/Time.hpp`
Time representation is critical. Never use generic `double seconds`. Use a rigorous representation of Barycentric Dynamical Time (TDB), which is required for CSPICE planetary lookups.

```cpp
#pragma once
#include <string>

namespace Astro {

class Epoch {
public:
    // Construct from Gregorian UTC string (e.g., "2026-05-24T12:00:00")
    static Epoch fromUTC(const std::string& utcStr);
    
    // Construct from Ephemeris Time (TDB seconds past J2000)
    static Epoch fromTDB(double tdbSeconds);

    double getTDB() const { return tdb; }
    double getMJD() const; // Modified Julian Date

    Epoch operator+(double seconds) const { return Epoch(tdb + seconds); }

private:
    explicit Epoch(double tdb_sec) : tdb(tdb_sec) {}
    double tdb; // Core internal time representation
};

}
```

### `ephem/SpiceWrapper.hpp`
Wraps the C-based NASA CSPICE library. Handles kernels and extracts rigorous states.

```cpp
#pragma once
#include <Eigen/Dense>
#include "core/Time.hpp"
#include "core/State.hpp"
#include <string>
#include <vector>

namespace Astro {

class SpiceSystem {
public:
    static void initialize(const std::vector<std::string>& kernels);
    static void clear();

    // Get exact state of a body relative to an observer at a specific TDB epoch
    // Returns [x, y, z, vx, vy, vz] in km and km/s
    static StateVector getState(const std::string& target, 
                                const Epoch& epoch, 
                                const std::string& frame = "J2000", 
                                const std::string& observer = "SUN");
                                
    static double getMu(const std::string& body);
};

} // namespace Astro
```

### `mission/LambertIzzo.hpp`
Izzo's algorithm (from ESA) is the industry standard for Lambert problems, avoiding singularities at 180 degrees and handling multi-revolution cases gracefully.

```cpp
#pragma once
#include <Eigen/Dense>
#include <vector>

namespace Astro {

struct LambertSolution {
    Eigen::Vector3d v1;
    Eigen::Vector3d v2;
    double a; // Semi-major axis
    int revs;
};

class LambertSolver {
public:
    // Solves the Lambert problem using Izzo's method.
    // Returns multiple solutions if multi-rev is requested.
    static std::vector<LambertSolution> solve(
        const Eigen::Vector3d& r1, 
        const Eigen::Vector3d& r2, 
        double tof_seconds, 
        double mu, 
        bool prograde = true,
        int max_revs = 0
    );
};

}
```

### `propagation/Propagator.hpp`
Numerical integration via Cowell's formulation (integrating total accelerations in Cartesian coordinates) coupled with an adaptive step-size integrator.

```cpp
#pragma once
#include <Eigen/Dense>
#include "core/Time.hpp"
#include "dynamics/ForceModel.hpp"
#include <vector>

namespace Astro {

struct PropagationResult {
    std::vector<Epoch> timeHistory;
    std::vector<Eigen::Vector6d> stateHistory;
    std::string terminationReason; // e.g., "TargetReached", "SOICrossing", "Atmosphere"
};

class Propagator {
public:
    Propagator(std::shared_ptr<ForceModel> forceModel);

    PropagationResult propagate(
        const Eigen::Vector6d& initialState,
        const Epoch& startEpoch,
        double maxDuration,
        double initialStep = 60.0
    );

    // Register event detectors (e.g., stopping condition at Mars SOI)
    void addEventDetector(std::shared_ptr<EventDetector> detector);

private:
    std::shared_ptr<ForceModel> forces;
    std::vector<std::shared_ptr<EventDetector>> events;
    
    // Abstracted integrator, e.g., Dormand-Prince 8(5,3)
    std::shared_ptr<Integrator> integrator; 
};

}
```

## 4. Mathematical Foundations

### 4.1 Propagation & Integration

**Cowell's Formulation**: The fundamental equation of motion in an N-body system with perturbations is:
$$ \ddot{\vec{r}} = - \frac{\mu}{|\vec{r}|^3} \vec{r} + \sum_{i=1}^{N} \mu_i \left( \frac{\vec{r}_{i} - \vec{r}}{|\vec{r}_i - \vec{r}|^3} - \frac{\vec{r}_i}{|\vec{r}_i|^3} \right) + \vec{a}_{perturbations} $$
Where the summation represents third-body gravitational interactions. Because interplanetary trajectories span massive distances and velocity ranges, fixed-step RK4 incurs enormous truncation errors. 
**Solution**: Use an adaptive integrator like **Dormand-Prince 8(5,3)** with absolute and relative error tolerances (e.g., $10^{-11}$). The integrator evaluates multiple stages and uses the difference between an 8th-order and 5th-order estimate to adjust the step size $\Delta t$ dynamically.

### 4.2 Event Detection & Discontinuities

Instead of discrete `if (distance < SOI)` checks which miss the exact boundary, use **Event Detection**.
Define a root-finding function $g(t, \vec{y})$. For an SOI crossing:
$$ g(t) = |\vec{r}_{sc}(t) - \vec{r}_{planet}(t)| - R_{SOI} $$
The propagator advances normally. If $g(t)$ changes sign between $t_0$ and $t_1$, the integrator pauses, and a Brent's method root-finder pinpoints the exact epoch $t_{crossing}$ where $g(t_{crossing}) = 0$. The state is interpolated, the central body is switched logically, and propagation restarts seamlessly.

### 4.3 Gravity Assists & B-Plane Targeting

Heuristic vector rotation during flybys violates conservation of specific orbital energy. True flybys must be plotted on the **B-Plane** (Body-plane). 
1. Determine the incoming hyperbolic excess velocity vector: $\vec{v}_{\infty, in} = \vec{v}_{sc} - \vec{v}_{planet}$.
2. The B-plane is orthogonal to $\vec{v}_{\infty, in}$.
3. Target parameters ($B \cdot \hat{T}$, $B \cdot \hat{R}$) define the aimpoint. 
4. The turn angle $\delta$ is determined precisely by the aimpoint magnitude $|B|$ and mass of the planet: $\sin(\delta/2) = \frac{1}{1 + \frac{|B| v_\infty^2}{\mu}}$.
5. The outgoing velocity $\vec{v}_{\infty, out}$ is computed strictly by rotating $\vec{v}_{\infty, in}$ by $\delta$ in the plane defined by $\vec{B}$ and $\vec{v}_{\infty, in}$.

### 4.4 Capture & Orbit Insertion

Capture is defined strictly by the specific energy of the two-body system relative to the target planet:
$$ \mathcal{E} = \frac{|\vec{v}_{rel}|^2}{2} - \frac{\mu_{planet}}{|\vec{r}_{rel}|} $$
If $\mathcal{E} > 0$, the trajectory is hyperbolic. To capture, a burn $\Delta \vec{v}$ must be applied at periapsis in the retrograde direction to reduce velocity until $\mathcal{E} < 0$. The $\Delta v$ required is:
$$ \Delta v = \sqrt{v_{\infty}^2 + \frac{2\mu}{r_p}} - \sqrt{\frac{2\mu}{r_p} - \frac{\mu}{a_{target}}} $$
This is mathematically rigorous, enabling precise measurement of required propellant.

## 5. API & Payload Structure

The backend should wrap all physics inside a REST/WebSocket API for frontend consumption.

**Example Endpoint: `/api/optimize-transfer`**
```json
// Request
{
  "origin": "Earth",
  "destination": "Mars",
  "earliest_departure": "2028-01-01T00:00:00Z",
  "latest_departure": "2029-01-01T00:00:00Z",
  "min_tof_days": 100,
  "max_tof_days": 400
}

// Response
{
  "best_departure": "2028-09-12T14:22:00Z",
  "best_arrival": "2029-05-18T09:11:00Z",
  "c3_energy": 12.5,
  "departure_dv_kms": 3.4,
  "arrival_dv_kms": 1.2,
  "v_infinity_out_ecliptic": [2.1, -1.5, 0.4] 
}
```

## 6. Implementation Roadmap & Migration Plan

### Phase 1: Foundational Framework (Weeks 1-2)
- **Goal**: Integrate NASA CSPICE and build the Time/Ephemeris layer.
- **Action**: Download standard `de440.bsp` (planets), `naif0012.tls` (leap seconds). Wrap them in the `SpiceSystem`.
- **Validation**: Verify that a generated Ephemeris query for Earth precisely matches JPL Horizons data over a 10-year span.

### Phase 2: Refined Mission Planning (Weeks 3-4)
- **Goal**: Replace the current iterative Lambert test.
- **Action**: Implement Izzo's Lambert algorithm in C++. Build a multithreaded Porkchop plot generator that scans thousands of epoch pairs, scoring them by arrival/departure $v_\infty$.
- **Validation**: Compare generated Earth-Mars delta-v contours with standard literature porkchop plots.

### Phase 3: High-Fidelity Propagation (Weeks 5-6)
- **Goal**: Replace RK4.
- **Action**: Implement Cowell's formulation with a DP8(5,3) adaptive integrator. Implement Brent's method for SOI event detection.
- **Validation**: Propagate a spacecraft from Earth to Mars. Verify that energy is mathematically conserved down to $10^{-11}$ numerical precision.

### Phase 4: API Binding & Frontend Migration (Weeks 7-8)
- **Goal**: Connect the new backend to the existing WebGL visualizer.
- **Action**: Stand up the C++ REST API using `httplib` or `Crow`. Output propagation states as strict coordinate arrays mapped to J2000. 
- **Migration**: Start migrating the frontend away from executing its own physics loops, switching it purely to a consumer of backend trajectory interpolation.

## 7. Build System (CMake)

```cmake
cmake_minimum_required(VERSION 3.20)
project(AstrodynamicsEngine VERSION 1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Enable aggressive optimization for numerics
set(CMAKE_CXX_FLAGS_RELEASE "-O3 -march=native -ffast-math")

# Find dependencies (installed via vcpkg or system)
find_package(Eigen3 CONFIG REQUIRED)
find_package(nlohmann_json CONFIG REQUIRED)
# SPICE must typically be linked manually or via custom FindCSPICE.cmake
# ...

add_executable(aero_backend 
    src/main.cpp
    src/core/Time.cpp
    src/ephem/SpiceWrapper.cpp
    src/mission/LambertIzzo.cpp
    src/propagation/Propagator.cpp
)

target_link_libraries(aero_backend PRIVATE 
    Eigen3::Eigen 
    nlohmann_json::nlohmann_json
    cspice # (Assuming wrapped target)
)
```

## 8. Common Failure Modes in Aerospace Software

1. **Frame Mixing**: Adding a velocity vector from the rotating Earth-Centered Earth-Fixed (ECEF) frame directly to an inertial J2000 vector. *Prevention*: Wrap all vectors in a Frame-aware class that asserts frames before operations.
2. **Loss of Precision**: Doing $r_{sc}$ (magnitude of millions of km) minus $r_{planet}$ (millions of km) using 32-bit floats. *Prevention*: Strictly enforce `double` (64-bit) everywhere. Use an origin-shifting strategy if simulating surface operations.
3. **Fixed Timestep Ghosting**: A fixed RK4 step size of 30 minutes might completely skip past a low-altitude planetary flyby due to discrete jumping. *Prevention*: Adaptive integrators strictly enforce error bounds, naturally shrinking the step size to seconds/milliseconds during periapsis.
4. **Ephemeris Extrapolation**: Querying planetary states beyond the limits of loaded SPK kernels results in subtle mathematical garbage or silent failure. *Prevention*: Rigorous exception handling inside the SPICE wrapper at boundaries.
