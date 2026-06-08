<p align="center">
 <img width="180" alt="transparent-image" src="https://github.com/user-attachments/assets/16c20926-5542-429b-84f6-c51561d8f15d" />
</p>

<h1 align="center">Space Flight Simulator</h1>

<p align="center">
  <strong>A simple, interactive 3D solar system and space flight simulator.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Frontend-React-007acc?style=for-the-badge&logo=react&logoColor=white" alt="React"/>
  <img src="https://img.shields.io/badge/Language-TypeScript-007acc?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Build_Tool-Vite-007acc?style=for-the-badge&logo=vite&logoColor=white" alt="Vite"/>
  <img src="https://img.shields.io/badge/Styling-Tailwind_CSS-007acc?style=for-the-badge&logo=tailwindcss&logoColor=white" alt="Tailwind"/>
</p>

---

> [!NOTE]
> Space Flight Simulator simulates how planets and spacecraft move in space.

## Core Features

* **Interactive Space Simulator** Watch how planets and spacecraft travel in a real-time 3D view.
  
* **Flight Path Planner** Find the best route and time to fly between planets.
  
* **Physics Engine** A simple math engine to calculate how things move in space.
  
* **Data Dashboard** A real-time screen to track spacecraft speed, position, and flight status.

---

## The Physics Engine

The core engine uses simple math rules to calculate how planets and objects move in outer space. The math ensures that planets closer to the sun move faster, and those further away move slower.

---

## Getting Started

### Prerequisites

* Ensure **Node.js** is installed on your local machine environment.

### Installation and Local Setup

1. **Clone the repository**

```bash
git clone https://github.com/UtkarshSharma000/ADHD.git
cd MapG
```

2. **Install dependencies**

```bash
npm install
```

3. **Launch the development workspace**

```bash
npm run dev
```

> [!IMPORTANT]
> If you are running the engine on a remote cloud virtual machine, verify your `vite.config.ts` configuration is set to expose the custom host network.

### Repository Structure

```plaintext
├── local_backend/          # Python automation and odyssey core engine files
├── public/                 # Static asset delivery (logos, icons, manifests)
├── src/                    # React application codebase
│   ├── components/         # Modular UI architecture (LaunchHUD, panel components)
│   ├── App.tsx             # Root application controller
│   ├── index.css           # Global style layout and Tailwind injections
│   └── OrbitSimulator.tsx  # Canvas rendering pipeline for celestial tracking
├── vite.config.ts          # Vite bundler and HMR server optimization
└── README.md               # System architectural documentation
```
