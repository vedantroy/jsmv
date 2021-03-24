import { parse } from "https://deno.land/std/flags/mod.ts";
import * as path from "https://deno.land/std@0.91.0/path/mod.ts";
import * as fs from "https://deno.land/std/fs/mod.ts";
import { HELP_MSG } from "./constants.ts";

const args = parse(Deno.args, {
  alias: { delete: "d", recursive: "r", preview: "p", help: "h" },
});
if (args._.length !== 2) {
  console.error(HELP_MSG);
  Deno.exit(1);
}

const optDelete = args.delete || false;
const optRecursive = args.recursive || false;
const optPreview = args.preview || false;
const optHelp = args.help || false;

if (optHelp) {
  console.log(HELP_MSG);
  Deno.exit(0);
}

let [dir, snippetOrFileName] = args._ as [string, string];
dir = path.resolve(dir);

if (!fs.existsSync(dir)) {
  console.error(`Path "${dir}" is not a directory.`);
  Deno.exit(1);
}

const snippet = fs.existsSync(snippetOrFileName)
  ? await Deno.readTextFile(snippetOrFileName)
  : snippetOrFileName;
// Sand-boxing is decent: `this` is undefined, global variables don't seem to be mutated
// Probably has holes though.
const createMutation: (f: FileObj) => void = new Function("f", snippet) as any;

const enum OpType {
  DELETE = "delete",
  MOVE = "move",
  COPY = "copy",
}

type Op = {
  type: OpType;
} & ({ newPath: string; oldPath: string } | {});

interface IFileObj {
  getOp(): Op | null;
}

class FileObj extends String implements IFileObj {
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

  toString(): string {
    return JSON.stringify(
      {
        path: this.path,
        dirname: this.dirname,
        name: this.name,
      },
      null,
      2,
    );
  }
}

let FileObjClass = FileObj;

if (args.fileObj) {
  if (args.fileObj === true) {
    console.error("--fileObj requires an argument");
    Deno.exit(1);
  }
  const text = Deno.readTextFileSync(args.fileObj);
  const f = new Function("FileObj", "fs", "path", text);
  FileObjClass = f(FileObj, fs, path);
  if (typeof FileObjClass !== "function") {
    throw new Error(`Custom fileObj snippet must return a class.`);
  }
  if (typeof FileObjClass.prototype.getOp !== "function") {
    throw new Error(`Custom fileObj class must have a "getOp" function`);
  }
}

function forEach(dir: string, cb: (oldPath: FileObj) => boolean | void) {
  const dirEntries = Array.from(Deno.readDirSync(dir));
  dirEntries.sort((a, b) => {
    return a.name.localeCompare(b.name);
  });
  for (const dirEntry of dirEntries) {
    const skipChildren = cb(new FileObjClass(dir, dirEntry.name));
    if (optRecursive) {
      if (!skipChildren && dirEntry.isDirectory) {
        forEach(path.join(dir, dirEntry.name), cb);
      }
    }
  }
}

// Deletes are done first in their own pass.
// This allows for operations like "Delete all files that end with .backup & copy all files to `${file_name}.backup`"
// without deleting the newly created files that end in .backup.
const toDelete = new Set<string>();
if (optDelete) {
  forEach(dir, (oldPath) => {
    createMutation(oldPath);
    if (oldPath.getOp()?.type === OpType.DELETE) {
      toDelete.add(oldPath.path);
      return true;
    }
    return false;
  });
}

const ops: Op[] = [];

forEach(dir, (oldPath) => {
  if (toDelete.has(oldPath.path)) return;
  createMutation(oldPath);
  const op = oldPath.getOp();
  if (op === null) return;
  if (op.type === OpType.DELETE) {
    console.error(
      `Tried to delete: "${oldPath}" but the delete flag (-d/--delete) wasn't set`,
    );
  }
  if (op !== null) {
    ops.push(op);
  }
});

const deletePromises = Array.from(toDelete.values()).map((path) => {
  console.log(`rm "${path}"`);
  if (!optPreview) {
    return Deno.remove(path);
  }
});
await Promise.all(deletePromises);

const opPromises = ops.map((op) => {
  const { oldPath, newPath } = op as any & { oldPath: string; newPath: string };
  if (op.type === OpType.COPY) {
    console.log(`cp "${oldPath}" "${newPath}"`);
    if (!optPreview) {
      return Deno.copyFile(oldPath, newPath);
    }
  } else if (op.type === OpType.MOVE) {
    console.log(`mv "${oldPath}" "${newPath}"`);
    if (!optPreview) {
      return fs.move(oldPath, newPath);
    }
  } else {
    throw new Error(
      `Unexpected opType: ${op.type}. Report this to the developer.`,
    );
  }
});
await Promise.all(opPromises);
