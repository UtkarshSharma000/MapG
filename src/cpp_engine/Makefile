# Makefile for C++ Physics Engine
CXX = g++
CXXFLAGS = -std=c++20 -O3 -Wall -Wextra

# Update this path if Eigen is installed elsewhere (e.g., /usr/local/include/eigen3)
INCLUDES = -I/usr/include/eigen3

TARGET = orbit_engine
SRC = orbit.cpp

all: $(TARGET)

$(TARGET): $(SRC)
	$(CXX) $(CXXFLAGS) $(INCLUDES) $(SRC) -o $(TARGET)

clean:
	rm -f $(TARGET)
