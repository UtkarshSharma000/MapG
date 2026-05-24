#include <iostream>
#include <string>
#include <cmath>
#include <vector>
#include <algorithm>
#include <Eigen/Dense>

// --- CONSTANTS ---
const double G = 6.67430e-11;
const double MU_SUN = 1.32712440018e20;
const double AU = 1.495978707e11;

const double MU = 3.986004418e14;
const double RE = 6371000.0;

typedef Eigen::Matrix<double, 6, 1> StateVector;

// --- PLANET ---
struct Planet {
    std::string name;
    double mass;
    double radius;
    double atmosphere_limit;
    double mu;
    double semi_major_axis;
    double orbital_period;

    Eigen::Vector3d pos;
    Eigen::Vector3d vel;
};

// --- SPACECRAFT ---
struct Spacecraft {
    Eigen::Vector3d pos = Eigen::Vector3d::Zero();
    Eigen::Vector3d vel = Eigen::Vector3d::Zero();
    double mass = 1000.0;
    double current_delta_v_pool = 3500.0;
    bool is_captured = false;
    bool is_overshot = false;
};

// --- CAPTURE BURN ---
void ExecuteCaptureBurn(Spacecraft& probe, const Planet& target) {
    if (probe.is_captured || probe.is_overshot) return;

    Eigen::Vector3d r_rel = probe.pos - target.pos;
    Eigen::Vector3d v_rel = probe.vel - target.vel;

    double r = r_rel.norm();
    double v = v_rel.norm();

    double soi = target.radius * 150.0;
    if (r > soi) return;

    double mu = target.mu;

    double energy = (v * v) / 2.0 - mu / r;

    if (energy <= 0.0) {
        probe.is_captured = true;
        return;
    }

    double h = r_rel.cross(v_rel).norm();

    double a_h = mu / (2.0 * energy);
    double e = std::sqrt(1.0 + (2.0 * energy * h * h) / (mu * mu));

    double rp = a_h * (e - 1.0);
    if (rp <= 0.0) rp = target.radius;

    if (r > rp * 1.05) return;

    double v_arrival = std::sqrt(2.0 * (energy + mu / rp));

    double target_period = 195.6 * 86400.0;
    double a_target = std::pow(
        mu * std::pow(target_period / (2.0 * M_PI), 2),
        1.0 / 3.0
    );

    double v_capture = std::sqrt(mu * (2.0 / rp - 1.0 / a_target));

    double dv = v_arrival - v_capture;

    if (dv <= 0.0) {
        probe.is_captured = true;
        return;
    }

    if (probe.current_delta_v_pool >= dv) {
        probe.current_delta_v_pool -= dv;
        probe.is_captured = true;
        probe.is_overshot = false;

        if (v_rel.norm() > 1e-9)
            probe.vel = target.vel + v_rel.normalized() * v_capture;
    } else {
        probe.is_overshot = true;
    }
}

// --- RK4 STEP ---
void rk4(StateVector& s, double dt) {
    auto f = [&](const StateVector& x) {
        StateVector dx;

        Eigen::Vector3d r(x(0), x(1), x(2));
        Eigen::Vector3d v(x(3), x(4), x(5));

        double dist = r.norm();
        double dist3 = dist * dist * dist;

        Eigen::Vector3d a = -MU * r / dist3;

        dx << v.x(), v.y(), v.z(), a.x(), a.y(), a.z();
        return dx;
    };

    StateVector k1 = f(s);
    StateVector k2 = f(s + 0.5 * dt * k1);
    StateVector k3 = f(s + 0.5 * dt * k2);
    StateVector k4 = f(s + dt * k3);

    s += (dt / 6.0) * (k1 + 2*k2 + 2*k3 + k4);
}

// --- SLINGSHOT ---
double PlanSlingshot(
    const Planet& p,
    const Eigen::Vector3d& vin,
    const Eigen::Vector3d& vout,
    double& dv_gain,
    bool& unsafe
) {
    Eigen::Vector3d vin_inf = vin - p.vel;
    Eigen::Vector3d vout_inf = vout - p.vel;

    double v = vin_inf.norm();
    if (v < 1e-9) {
        dv_gain = 0;
        unsafe = true;
        return p.radius;
    }

    Eigen::Vector3d vout_dir = vout_inf.normalized() * v;

    double cosT = vin_inf.dot(vout_dir) / (v * v);
    cosT = std::clamp(cosT, -1.0, 1.0);

    double theta = std::acos(cosT);

    double rp;
    if (std::sin(theta / 2.0) > 1e-9) {
        rp = (p.mu / (v * v)) * ((1.0 / std::sin(theta / 2.0)) - 1.0);
    } else {
        rp = p.radius;
    }

    double safe = p.radius + p.atmosphere_limit;
    unsafe = (rp < safe);

    dv_gain = (vout_dir - vin_inf).norm();

    return rp;
}

// --- SYSTEM INIT ---
std::vector<Planet> Init() {
    std::vector<Planet> v;

    v.push_back({"Earth", 5.972e24, 6371000, 120000, G*5.972e24, AU, 365.25*86400,
                 {AU,0,0},{0,29780,0}});

    v.push_back({"Jupiter", 1.898e27, 69911000, 1000000, G*1.898e27, 5.2*AU,
                 11.86*365.25*86400, {5.2*AU,0,0},{0,13070,0}});

    return v;
}

// --- MAIN ---
int main() {
    auto planets = Init();
    const Planet& j = planets[1];

    Eigen::Vector3d vin(5600, 11000, 0);
    Eigen::Vector3d vout(8200, 14200, 0);

    double dv;
    bool unsafe;

    double rp = PlanSlingshot(j, vin, vout, dv, unsafe);

    std::cerr << "SLINGSHOT TEST\n";
    std::cerr << "Planet: " << j.name << "\n";
    std::cerr << "rp: " << rp/1000 << " km\n";
    std::cerr << "dv gain: " << dv << "\n";
    std::cerr << "unsafe: " << unsafe << "\n";

    StateVector s;
    s << RE + 100000, 0, 0, 0, 7800, 0;

    for (int i = 0; i < 1000; i++)
        rk4(s, 1.0);

    std::cout << "{"
              << "\"x\":" << s(0) << ","
              << "\"y\":" << s(1) << ","
              << "\"z\":" << s(2)
              << "}\n";

    return 0;
}