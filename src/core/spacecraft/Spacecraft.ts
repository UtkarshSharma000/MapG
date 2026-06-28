import { SpacecraftComponent } from "./Component";
import { Connection } from "./Connection";
import { Stage } from "./Stage";

export class Spacecraft {
  id: string;
  components: Map<string, SpacecraftComponent>;
  connections: Connection[];
  stages: Stage[];
  
  constructor(id: string) {
    this.id = id;
    this.components = new Map();
    this.connections = [];
    this.stages = [];
  }
  
  addComponent(component: SpacecraftComponent) {
    this.components.set(component.id, component);
  }
  
  addConnection(connection: Connection) {
    this.connections.push(connection);
    
    // Update graph topology
    const parent = this.components.get(connection.parentId);
    const child = this.components.get(connection.childId);
    if (parent && child) {
      child.parent = parent.id;
      parent.children.push(child.id);
    }
  }
  
  serialize() {
    return {
      id: this.id,
      components: Array.from(this.components.values()),
      connections: this.connections,
      stages: this.stages
    };
  }
  
  static deserialize(data: any): Spacecraft {
    const sc = new Spacecraft(data.id);
    if (data.components) {
      data.components.forEach((c: any) => {
        const comp = new SpacecraftComponent(c.id, c.props);
        comp.transform = c.transform;
        comp.parent = c.parent;
        comp.children = c.children;
        sc.addComponent(comp);
      });
    }
    if (data.connections) {
      sc.connections = data.connections;
    }
    if (data.stages) {
      sc.stages = data.stages;
    }
    return sc;
  }
}
