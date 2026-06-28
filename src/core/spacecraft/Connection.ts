export interface Connection {
  id: string;
  parentId: string;
  childId: string;
  
  // Physics properties of the joint
  strength: number; 
  isDecoupler: boolean;
  stageIndex?: number;
}
