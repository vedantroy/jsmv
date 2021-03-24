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
  // *entry* = The current file/directory being operated on
  // The absolute path of the current entry
  path: string;
  // The absolute path of the directory containing the current entry
  dirname: string;
  // The name of the current entry
  name: string;

  // We use underscore b/c the eval function
  // can still access these "private" properties.
  private _opType?: OpType;
  private _newPath?: string;

  // Custom fileObj classes can accept these 2 parameters
  constructor(absDirPath: string, name: string) {
    const absPath = path.join(absDirPath, name);
    super(absPath);
    this.path = absPath;
    this.dirname = absDirPath;
    this.name = name;
  }

  // Custom fileObj classes must implement this method
  getOp(): Op | null {
    if (this._opType === undefined) return null;
    const op: Op = { type: this._opType };
    if (this._opType !== OpType.DELETE) {
      (op as any).newPath = this._newPath;
      (op as any).oldPath = this.path;
    }
    return op;
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

  private _makeAbsolute(path_: string): string {
    return path.isAbsolute(path_) ? path_ : path.join(this.dirname, path_);
  }

  // Delete the current entry
  del() {
    this.registerOp(OpType.DELETE);
  }

  // Move the current entry
  // If `newPath` is absolute then move the current entry to `newPath`
  // Otherwise, join `newPath` to the path of the parent directory of the entry.
  mv(newPath: string) {
    this.registerOp(OpType.MOVE);
    this._newPath = this._makeAbsolute(newPath);
  }

  // Move, but it copies
  cp(newPath: string) {
    this.registerOp(OpType.COPY);
    this._newPath = this._makeAbsolute(newPath);
  }

  // No `toString` because it breaks templating
  // i.e `${f}.js` to add the .js extension wouldn't work

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
