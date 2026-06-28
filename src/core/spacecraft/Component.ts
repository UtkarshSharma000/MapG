// Core component interface representing a node in the spacecraft graph

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface ComponentProperties {
  type: string;
  mass: number;
  dragCoefficient: number;
  heatResistance: number;
  strength: number;
  fuel?: number;
  fuelCapacity?: number;
  thrust?: number;
  isp?: number;
}

export class SpacecraftComponent {
  id: string;
  props: ComponentProperties;
  transform: {
    position: Vector3;
    rotation: Vector3; // Euler angles for simplicity
  };
  
  parent: string | null = null;
  children: string[] = [];
  
  constructor(id: string, props: ComponentProperties) {
    this.id = id;
    this.props = props;
    this.transform = { position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } };
  }

  getMass(): number {
    return this.props.mass + (this.props.fuel || 0);
  }

  getDragArea(): number {
    // Simplified: uses type/shape approximation or explicit bounding area
    return this.props.dragCoefficient;
  }

  getLift(): number {
    return this.props.type === 'fin' ? 2.0 : 0.0;
  }

  getFuel(): number {
    return this.props.fuel || 0;
  }
  
  getStrength(): number {
    return this.props.strength;
  }

  getHeatResistance(): number {
    return this.props.heatResistance;
  }

  getThrust(): number {
    return this.props.thrust || 0;
  }

  getCenterOfMassContribution(): Vector3 {
    // Relative to part origin
    return { x: 0, y: 0, z: 0 }; 
  }

  getCenterOfPressureContribution(): Vector3 {
    return { x: 0, y: 0, z: 0 };
  }
}
