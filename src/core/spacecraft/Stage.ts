export interface Stage {
  id: string;
  index: number;
  decouplerIds: string[]; // IDs of connections that break when this stage activates
}
