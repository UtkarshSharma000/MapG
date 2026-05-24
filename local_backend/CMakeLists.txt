cmake_minimum_required(VERSION 3.20)

project(AeroBackend VERSION 1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(CMAKE_CXX_FLAGS_RELEASE
    "-O3 -march=native -ffast-math -pthread"
)

find_package(Eigen3 CONFIG REQUIRED)

include_directories(
    src
    /usr/include/eigen3
    ${CMAKE_SOURCE_DIR}/external
    ${CMAKE_SOURCE_DIR}/cspice/include
)

add_executable(aero_backend

    src/main.cpp

    src/core/Time.cpp
    src/ephem/SpiceWrapper.cpp
    src/mission/LambertIzzo.cpp
    src/propagation/Propagator.cpp
)

target_link_libraries(aero_backend PRIVATE
    Eigen3::Eigen
    ${CMAKE_SOURCE_DIR}/cspice/lib/cspice.a
    pthread
)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_FLAGS_RELEASE "-O3 -march=native -ffast-math -pthread")

# Eigen dependency
# Assuming Eigen3 is installed via apt or placed in /usr/include/eigen3
find_package(Eigen3 CONFIG QUIET)
if (NOT Eigen3_FOUND)
    include_directories(/usr/include/eigen3)
else()
    include_directories(${EIGEN3_INCLUDE_DIRS})
endif()

include_directories(src)
include_directories(${CMAKE_SOURCE_DIR}/cspice/include)

add_executable(aero_backend 
    src/main.cpp
    src/core/Time.cpp
    src/ephem/SpiceWrapper.cpp
    src/mission/LambertIzzo.cpp
    src/propagation/Propagator.cpp
)

# Link against the local CSPICE library and pthread for the web server
target_link_libraries(aero_backend
    ${CMAKE_SOURCE_DIR}/cspice/lib/cspice.a
    pthread
)
