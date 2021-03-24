import * as path from "https://deno.land/std@0.91.0/path/mod.ts";

export const enum OpType {
  DELETE = "delete",
  MOVE = "move",
  COPY = "copy",
}

export type Op = {
  type: OpType;
} & ({ newPath: string; oldPath: string } | {});

interface IFileObj {
  getOp(): Op | null;
}

export class FileObj extends String implements IFileObj {
  path: string;
  dirname: string;
  name: string;

  // We use underscore b/c the eval function
  // can still access these "private" properties.
  private _opType?: OpType;
  private _newPath?: string;

  constructor(absDirPath: string, name: string) {
    const absPath = path.join(absDirPath, name);
    super(absPath);
    this.path = absPath;
    this.dirname = absDirPath;
    this.name = name;
  }

  private registerOp(opType: OpType) {
    if (this._opType !== undefined) {
      throw new Error(
        `Cannot do "${opType}" when already done "${this._opType}"`,
      );
    } else {
      this._opType = opType;
    }
  }

  getOp(): Op | null {
    if (this._opType === undefined) return null;
    const op: Op = { type: this._opType };
    if (this._opType !== OpType.DELETE) {
      (op as any).newPath = this._newPath;
      (op as any).oldPath = this.path;
    }
    return op;
  }

  private _makeAbsolute(path_: string): string {
    return path.isAbsolute(path_) ? path_ : path.join(this.dirname, path_);
  }

  del() {
    this.registerOp(OpType.DELETE);
  }

  mv(newPath: string) {
    this.registerOp(OpType.MOVE);
    this._newPath = this._makeAbsolute(newPath);
  }

  cp(newPath: string) {
    this.registerOp(OpType.COPY);
    this._newPath = this._makeAbsolute(newPath);
  }

  //toString(): string {
  //  return JSON.stringify(
  //    {
  //      path: this.path,
  //      dirname: this.dirname,
  //      name: this.name,
  //    },
  //    null,
  //    2,
  //  );
  //}
}
