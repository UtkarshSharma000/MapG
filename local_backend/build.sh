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

echo "--- Probing for any compiler-like tools ---"
which g++ clang++ c++ gcc clang cc > local_backend/compiler_test.txt 2>&1 || true
find /usr -name "g++*" -o -name "clang*" -o -name "gcc*" >> local_backend/compiler_test.txt 2>&1 || true
echo "Found files written to compiler_test.txt"

echo "--- Compiling Propagator ---"
COMPILER=""
for c in g++ clang++ c++ CC; do
    if command -v $c >/dev/null 2>&1; then
        COMPILER=$c
        break
    fi
done

if [ -z "$COMPILER" ]; then
    echo "ERROR: No C++ compiler found (tried g++, clang++, c++, CC)"
    exit 1
fi

echo "Using compiler: $COMPILER"
ARCH=$(uname -m)
if [ "$ARCH" = "aarch64" ]; then
    OPT_FLAGS="-O3 -flto -funroll-loops -fno-rtti -mcpu=neoverse-n1"
else
    OPT_FLAGS="-O3 -flto -funroll-loops -fno-rtti -mtune=native"
fi
$COMPILER $OPT_FLAGS -std=c++17 $EIGEN_INC local_backend/engine.cpp -o local_backend/odyssey_engine || \
$COMPILER -O3 -std=c++17 $EIGEN_INC local_backend/engine.cpp -o local_backend/odyssey_engine

echo "--- Setting Permissions ---"
chmod +x local_backend/odyssey_engine

echo "--- Build Successful: ./local_backend/odyssey_engine ---"
