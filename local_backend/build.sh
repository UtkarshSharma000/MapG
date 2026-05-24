#!/bin/bash
# Odyssey 2026 Build Script
set -e

echo "--- Installing Dependencies ---"
# Note: In the AI Studio container, we use the local eigen directory if apt fails
if ! dpkg -s libeigen3-dev >/dev/null 2>&1; then
    echo "libeigen3-dev not found, attempting local fallback..."
    if [ ! -d "local_backend/eigen" ]; then
        cd local_backend
        curl -L -o eigen.tar.gz https://gitlab.com/libeigen/eigen/-/archive/3.4.0/eigen-3.4.0.tar.gz
        tar -xzf eigen.tar.gz
        mv eigen-3.4.0 eigen
        rm eigen.tar.gz
        cd ..
    fi
    EIGEN_INC="-I./local_backend/eigen"
else
    EIGEN_INC="-I/usr/include/eigen3"
fi

echo "--- Compiling Propagator ---"
ARCH=$(uname -m)
if [ "$ARCH" = "aarch64" ]; then
    OPT_FLAGS="-O3 -mcpu=neoverse-n1"
else
    OPT_FLAGS="-O3 -march=native"
fi
g++ $OPT_FLAGS -std=c++17 $EIGEN_INC local_backend/Propagator.cpp -o local_backend/odyssey_engine || \
g++ -O3 -std=c++17 $EIGEN_INC local_backend/Propagator.cpp -o local_backend/odyssey_engine

echo "--- Setting Permissions ---"
chmod +x local_backend/odyssey_engine

echo "--- Build Successful: ./local_backend/odyssey_engine ---"
