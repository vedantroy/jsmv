import { fs, path } from "@deps.ts";

type FSEntry = {
  type: "file" | "dir";
  text?: string;
  name: string;
  children?: FSEntry[];
};

export function getFolderStructure(root: string): FSEntry {
  return {
    type: "dir",
    name: path.basename(root),
    children: _getFolderStructure(root),
  };
}

function _getFolderStructure(curPath: string): FSEntry[] {
  const entries: FSEntry[] = [];
  const dirEntries = Array.from(Deno.readDirSync(curPath));
  for (const { name, isDirectory } of dirEntries) {
    if (isDirectory) {
      entries.push({
        type: "dir",
        name,
        children: _getFolderStructure(path.join(curPath, name)),
      });
    } else {
      const text = Deno.readTextFileSync(path.join(curPath, name));
      entries.push({
        type: "file",
        name,
        text,
      });
    }
  }
  return entries;
}

// Traverse an object & replace all values that
// match the replacer function.
// Doe
export function replace(obj: any, process: (obj: unknown) => [boolean, any]) {
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v !== "object" || v === null) continue;
    const [shouldReplace, newObj] = process(v);
    if (shouldReplace) {
      // @ts-ignore
      obj[k] = newObj;
    } else if (Array.isArray(v)) {
      for (let i = 0; i < v.length; ++i) {
        const element = v[i];
        const [shouldReplace, newObj] = process(element);
        if (shouldReplace) {
          v[i] = newObj;
        } else replace(element, process);
      }
    } else replace(v, process);
  }
}
