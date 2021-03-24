import { parse } from "https://deno.land/std/flags/mod.ts";
import * as path from "https://deno.land/std@0.91.0/path/mod.ts";
import * as fs from "https://deno.land/std/fs/mod.ts";
import { HELP_MSG } from "./constants.ts";
import { FileObj, Op, OpType } from "./defaultFileObj.ts";

const args = parse(Deno.args, {
  alias: {
    delete: "d",
    recursive: "r",
    preview: "p",
    help: "h",
    quiet: "q",
    overwrite: "o",
  },
});
if (args._.length !== 2) {
  console.error(HELP_MSG);
  Deno.exit(1);
}

const optDelete = args.delete || false;
const optRecursive = args.recursive || false;
const optPreview = args.preview || false;
const optHelp = args.help || false;
const optQuiet = args.quiet || false;
const optOverwrite = args.overwrite || false;

const configPath = Deno.env.get("EASYMOVE_FILEOBJ_PATH");
if (configPath !== undefined && !args.fileObj) {
  if (!fs.existsSync(configPath)) {
    console.warn(`No config at "${configPath}"`);
  } else {
    args.fileObj = configPath;
  }
}

if (optHelp) {
  console.log(HELP_MSG);
  Deno.exit(0);
}

if (optQuiet) {
  console.log = () => {};
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
const newFiles = new Set<string>();

forEach(dir, (oldPath) => {
  if (toDelete.has(oldPath.path)) return;
  createMutation(oldPath);
  const op = oldPath.getOp();
  if (op === null) return;
  if (op.type === OpType.DELETE) {
    console.error(
      `Tried to delete: "${oldPath.path}" but -d/--delete wasn't set`,
    );
    Deno.exit(1);
  }
  if (op !== null) {
    if (!optOverwrite && (op.type === OpType.COPY || op.type === OpType.MOVE)) {
      const { oldPath, newPath } = op as any;
      const overWritingFile = !toDelete.has(newPath) &&
        (fs.exists(newPath) || newFiles.has(newPath));
      if (overWritingFile) {
        console.error(
          `Tried to overwrite ${newPath} with ${op.type} from "${oldPath}" but -o/--overwrite wasn't set`,
        );
        Deno.exit(1);
      }
      newFiles.add(newPath);
    }
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
      // We allow overwrite here b/c we already check for disallowed overwrites above.
      return fs.move(oldPath, newPath, { overwrite: true });
    }
  } else {
    throw new Error(
      `Unexpected opType: ${op.type}. Report this to the developer.`,
    );
  }
});
await Promise.all(opPromises);
