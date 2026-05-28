<p align="center">
 <img width="180" alt="transparent-image" src="https://github.com/user-attachments/assets/16c20926-5542-429b-84f6-c51561d8f15d" />
</p>

<h1 align="center">Project Greninja (MapG)</h1>

<p align="center">
  <strong>A high-performance, interactive orbital mechanics and trajectory simulator.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-React-007acc?style=for-the-badge&logo=react&logoColor=white" alt="React"/>
  <img src="https://img.shields.io/badge/Language-TypeScript-007acc?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Build_Tool-Vite-007acc?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"/>
  <img src="https://img.shields.io/badge/Styling-Tailwind_CSS-007acc?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind"/>
  <img src="https://img.shields.io/badge/Backend-Python-007acc?style=for-the-badge&logo=python&logoColor=white" alt="Python"/>
</p>

---

> [!NOTE]
> The MapG core engine simulates complex celestial paths, planetary rotation, and automated porkchop plotting utilizing custom-built visual rendering physics.

## Core Features

* **Interactive Orbit Simulator** Visualizes precise planetary trajectories and satellite orbits in a real-time, canvas-based environment.
  
* **Automated Porkchop Plotting** Integrated porkchop plots map out delta-v requirements and pinpoint optimal interplanetary launch windows.
  
* **Custom Physics Engine (`greninja_engine`)** Built entirely from the ground up to handle rotational velocity tracking, coordinate translation, and discrete vector positioning.
  
* **Launch HUD** A real-time, sleek dashboard telemetry overlay designed to monitor instantaneous velocities, orbital states, and system metrics during simulation.

---

## The Physics Engine (`greninja_engine`)

The core engine maps out planetary behavior using custom direct-proportionality scaling equations optimized for fixed circular tracks. 

Instead of relying on heavy traditional textbook derivations, the system calculates rotational tracking speeds ($R_v$) relative to linear velocities ($V_s$) using a strict custom scaling constant $k$, where:

$$R_v = k \cdot V_s$$

> [!TIP]
> The scaling factor $k$ automatically scales as $\frac{1}{\text{radius}}$. This balances the visual tracking display seamlessly across vastly different cosmic scales—ranging from Low Earth Orbit up to full solar system paths.

---

## Getting Started

### Prerequisites

* Ensure **Node.js** is installed on your local machine environment.

### Installation and Local Setup

1. **Clone the repository**

```bash
git clone [https://github.com/UtkarshSharma000/ADHD.git](https://github.com/UtkarshSharma000/ADHD.git)
cd MapG
Install dependencies

Bash
npm install
Launch the development workspace

Bash
npm run dev
[!IMPORTANT]

If you are running the engine on a remote cloud virtual machine, verify your vite.config.ts configuration is set to expose the custom host network.

Repository Structure
Plaintext
├── local_backend/          # Python automation and odyssey core engine files
├── public/                 # Static asset delivery (logos, icons, manifests)
├── src/                    # React application codebase
│   ├── components/         # Modular UI architecture (LaunchHUD, panel components)
│   ├── App.tsx             # Root application controller
│   ├── index.css           # Global style layout and Tailwind injections
│   └── OrbitSimulator.tsx  # Canvas rendering pipeline for celestial tracking
├── vite.config.ts          # Vite bundler and HMR server optimization
└── README.md               # System architectural documentation
