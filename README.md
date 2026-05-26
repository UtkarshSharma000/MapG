<p align="center">
  <img src="public/logo.png" alt="Project Greninja Logo" width="200"/>
</p>

# Project Greninja (MapG)

An interactive orbital mechanics and trajectory simulator built with React, TypeScript, and Vite. The engine simulates celestial paths, planetary rotation, and porkchop plotting utilizing custom physics engines.

---

## Features

* **Interactive Orbit Simulator:** Visualizes planetary trajectories and satellite orbits in real-time.
* **Automated Porkchop Plotting:** Integrated porkchop plots to calculate optimal interplanetary launch windows and delta-v requirements.
* **Custom Physics Engine (greninja_engine):** Built from scratch to handle rotational velocity tracking and vector positioning.
* **Launch HUD:** Real-time dashboard overlay to monitor telemetry, velocities, and orbital states during simulation.

---

## The Physics Engine (greninja_engine)

The core engine maps out planetary behavior using custom direct-proportionality scaling equations for fixed circular tracks. 

Instead of traditional textbook derivations, the engine handles rotational tracking speeds ($R_v$) relative to linear velocities ($V_s$) using a strict custom scaling constant $k$, where:

$$R_v = k \cdot V_s$$

Where the proportionality constant $k$ effectively scales as $\frac{1}{\text{radius}}$ to balance visual tracking across massive scales—from Low Earth Orbit up to full solar system paths.

---

## Tech Stack

* **Frontend:** React, TypeScript, Vite
* **Styling:** Tailwind CSS
* **Backend/Simulation Scripts:** Python (Local backend engine tracking paths)

---

## Getting Started

### Prerequisites
Ensure Node.js is installed on your system.

### Installation and Local Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/YOUR_MAIN_USERNAME/ADHD.git](https://github.com/YOUR_MAIN_USERNAME/ADHD.git)
   cd MapG
