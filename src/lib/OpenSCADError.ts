class OpenSCADError extends Error {
  code: string;
  stdErr: string[];

  constructor(message: string, code: string, stdErr: string[]) {
    super(message);
    this.code = code;
    this.stdErr = stdErr;
  }
}

export default OpenSCADError;
