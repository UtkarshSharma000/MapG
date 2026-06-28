export class Report {
  errors: string[] = [];
  warnings: string[] = [];
  infos: string[] = [];
  isValid: boolean = true;

  addError(msg: string) {
    this.errors.push(msg);
  }
  
  addWarning(msg: string) {
    this.warnings.push(msg);
  }
  
  addInfo(msg: string) {
    this.infos.push(msg);
  }
}
