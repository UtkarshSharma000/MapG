#!/bin/bash
set -e

# Change into the directory of the script
cd "$(dirname "$0")"

echo "=== Odyssey Local-Core Build Script ==="

# 1. Download Eigen if it doesn't exist
if [ ! -d "eigen" ]; then
    echo "[1/3] Downloading Eigen (3.4.0) library..."
    curl -L -o eigen.tar.gz https://gitlab.com/libeigen/eigen/-/archive/3.4.0/eigen-3.4.0.tar.gz
    tar -xzf eigen.tar.gz
    mv eigen-3.4.0 eigen
    rm eigen.tar.gz
else
    echo "[1/3] Eigen library already present."
fi

# 2. Compile the C++ Physics Engine
echo "[2/3] Compiling C++ engine with g++ -O3..."
g++ -O3 -std=c++17 -I./eigen engine.cpp -o engine
echo "-- Compilation successful. Output: ./engine"

# 3. Setup Python environment (Optional/Info)
echo "[3/3] Build complete!"
echo ""
echo "=== How to run the local API ==="
echo "1. Ensure Python dependencies are installed:"
echo "   pip install -r requirements.txt"
echo "2. Start the FastAPI server:"
echo "   uvicorn main:app --reload --host 0.0.0.0 --port 8000"
echo ""
echo "The API will be available at http://localhost:8000/telemetry"
