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
