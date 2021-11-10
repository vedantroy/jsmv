import { fs, parse, path } from "@deps.ts";
import { HELP_MSG } from "./constants.ts";
import { FileObj, Op, OpType } from "./defaultFileObj.ts";

function fatal(s: string) {
  console.error(s);
  Deno.exit(1);
}

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
  fatal(HELP_MSG);
}

const optDelete = args.delete || false;
const optRecursive = args.recursive || false;
const optPreview = args.preview || false;
const optHelp = args.help || false;
const optQuiet = args.quiet || false;
const optOverwrite = args.overwrite || false;

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
  fatal(`Path "${dir}" is not a directory.`);
}

const snippet = fs.existsSync(snippetOrFileName)
  ? await Deno.readTextFile(snippetOrFileName)
  : snippetOrFileName;
// Sand-boxing is decent: `this` is undefined, global variables don't seem to be mutated
// Probably has holes though.
const createMutation: (f: FileObj, ctx: any) => void = new Function(
  "f",
  "ctx",
  snippet,
) as any;

let FileObjClass = FileObj;

function envOrOpt(
  optName: string,
  isPath: boolean,
  cb: (optVal: string) => void,
) {
  const envName = `JSMOVE_${optName.toUpperCase()}${isPath ? "_PATH" : null}`;
  const val = Deno.env.get(envName);
  if (isPath && val !== undefined && !args[optName]) {
    if (!fs.existsSync(val)) {
      console.warn(`No file at "${val}" provided by ${envName}`);
    } else {
      args[optName] = val;
    }
  }

  if (args[optName]) {
    if (args[optName] === true) {
      fatal(`--${optName} requires an argument`);
    }
    cb(args[optName]);
  }
}

envOrOpt("fileObj", true, (p) => {
  const text = Deno.readTextFileSync(p);
  const f = new Function("FileObj", "fs", "path", text);
  FileObjClass = f(FileObj, fs, path);
  if (typeof FileObjClass !== "function") {
    throw new Error(`Custom fileObj snippet must return a class.`);
  }
  if (typeof FileObjClass.prototype.getOp !== "function") {
    throw new Error(`Custom fileObj class must have a "getOp" function`);
  }
});

let ctx = {};
envOrOpt("ctx", false, (text) => {
  const toEval = `return ${text}`;
  try {
    const f = new Function(toEval);
    ctx = f();
  } catch (e) {
    fatal(`Could not create/execute function created from "${toEval}"`);
  }
});

function forEach(dir: string, cb: (oldPath: FileObj) => boolean | void) {
  const dirEntries = Array.from(Deno.readDirSync(dir));
  dirEntries.sort((a, b) => {
    return a.name.localeCompare(b.name);
  });
  for (const { name, isDirectory, isFile } of dirEntries) {
    const skipChildren = cb(
      new FileObjClass(dir, name, {
        cliArgs: args,
        isDir: isDirectory,
        isFile: isFile,
        ctx,
      }),
    );
    if (optRecursive) {
      if (!skipChildren && isDirectory) {
        forEach(path.join(dir, name), cb);
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
    createMutation(oldPath, ctx);
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
  createMutation(oldPath, ctx);
  const op = oldPath.getOp();
  if (op === null) return;
  if (op.type === OpType.DELETE) {
    fatal(`Tried to delete: "${oldPath.path}" but -d/--delete wasn't set`);
  }
  if (!optOverwrite && (op.type === OpType.COPY || op.type === OpType.MOVE)) {
    const { oldPath, newPath } = op as any;
    const overWritingFile = !toDelete.has(newPath) &&
      (fs.existsSync(newPath) || newFiles.has(newPath));
    if (overWritingFile) {
      fatal(
        `Tried to overwrite ${newPath} with ${op.type} from "${oldPath}" but -o/--overwrite wasn't set`,
      );
    }
    newFiles.add(newPath);
  }
  ops.push(op);
});

function getPaths(op: Op, name: string): [string, string] {
  const { oldPath, newPath } = op;
  if (oldPath === undefined || newPath === undefined) {
    throw new Error(
      `Op: ${op} had undefined oldPath or newPath. If using the default FileObj class report this to the developer. Otherwise, check your implementation.`,
    );
  }
  console.log(`${name} "${oldPath}" "${newPath}"`);
  return [oldPath, newPath];
}

const deletePromises = Array.from(toDelete.values()).map((path) => {
  console.log(`rm "${path}"`);
  if (!optPreview) {
    return Deno.remove(path, { recursive: true });
  }
});
await Promise.all(deletePromises);

const opPromises = ops.map((op) => {
  if (op.type === OpType.COPY) {
    const [oldPath, newPath] = getPaths(op, "cp");
    if (!optPreview) {
      return Deno.copyFile(oldPath, newPath);
    }
  } else if (op.type === OpType.MOVE) {
    const [oldPath, newPath] = getPaths(op, "mv");
    if (!optPreview) {
      // We allow overwrite here b/c we already check for disallowed overwrites above.
      return fs.move(oldPath, newPath, { overwrite: true });
    }
  } else {
    throw new Error(
      `Unexpected operation: ${op}. Report this to the developer.`,
    );
  }
});
await Promise.all(opPromises);
