import { getFolderStructure, replace } from "./utils.ts";
import { assertEquals, fs, path, hash } from "@deps.ts";

function sortArraysInObject(o: any) {
  if (o === undefined || o === null || typeof o === "string") return;
  for (const [k, v] of Object.entries(o)) {
    if (Array.isArray(v)) {
      o[k] = v.sort((a, b) => {
        const ha = hash(a);
        const hb = hash(b);
        return ha < hb ? 1 : ha === hb ? 0 : -1;
      });
      for (const v2 of v) {
        sortArraysInObject(v2);
      }
    } else {
      sortArraysInObject(v);
    }
  }
}

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

const e2eTestsDir = path.join(__dirname, "e2e");
const e2eTests = Deno.readDirSync(e2eTestsDir);
for (const entry of e2eTests) {
  const testName = `e2e-${entry.name}`;
  Deno.test(testName, async () => {
    const entryPath = path.resolve(e2eTestsDir, entry.name);
    const oldPath = path.resolve(entryPath, "base");
    const newPath = path.resolve(entryPath, "temp");
    await fs.emptyDir(newPath);
    await fs.copy(oldPath, newPath, { overwrite: true });

    const cmdInfo = JSON.parse(
      await Deno.readTextFile(path.join(entryPath, "cmd.json"))
    );
    replace(cmdInfo, (o: any) => {
      if (o && o.type === "path") {
        const absPath = path.resolve(entryPath, o.value);
        if (!fs.existsSync(absPath)) {
          throw new Error(
            `Path ${o.value} transformed to ${absPath} does not exist`
          );
        }
        return [true, absPath];
      }
      return [false, null];
    });
    let paramsString = "";
    for (const param of cmdInfo.params) {
      paramsString += ` "${param}"`;
    }
    const cmd = `./jsmv ${newPath}${paramsString}`;
    const proc = await Deno.run({
      cmd: ["./jsmv", newPath, ...cmdInfo.params],
    });
    const status = await proc.status();
    proc.close();
    if (!status.success) {
      throw new Error(`Command: ${cmd} failed`);
    }
    const structure = getFolderStructure(newPath);
    const expectedPath = path.join(entryPath, "expected.json");
    if (!fs.existsSync(expectedPath)) {
      console.log(`Creating new snapshot for ${testName}`);
      const stringified = JSON.stringify(structure, null, 2);
      await Deno.writeTextFile(expectedPath, stringified);
    }
    const expected = JSON.parse(await Deno.readTextFile(expectedPath));
    sortArraysInObject(structure);
    sortArraysInObject(expected);
    assertEquals(structure, expected);
  });
}
