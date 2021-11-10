import { replace } from "./utils.ts";
import { assertEquals, fs, hash, path } from "@deps.ts";
import * as dree from "@lib/dree.ts";
import deepEqual from "@lib/deep_equal.ts";

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

const e2eTestsDir = path.join(__dirname, "e2e");
const e2eTests = Deno.readDirSync(e2eTestsDir);
for (const entry of e2eTests) {
  const testName = `e2e-${entry.name}`;
  Deno.test(testName, async () => {
    const entryPath = path.resolve(e2eTestsDir, entry.name);
    const oldPath = path.resolve(entryPath, "base");
    const newPath = path.resolve(entryPath, "temp");
    const expectedPath = path.resolve(entryPath, "expected");

    await fs.emptyDir(newPath);
    await fs.copy(oldPath, newPath, { overwrite: true });

    const cmdInfo = JSON.parse(
      await Deno.readTextFile(path.join(entryPath, "cmd.json")),
    );
    replace(cmdInfo, (o: any) => {
      if (o && o.type === "path") {
        const absPath = path.resolve(entryPath, o.value);
        if (!fs.existsSync(absPath)) {
          throw new Error(
            `Path ${o.value} transformed to ${absPath} does not exist`,
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

    if (!fs.existsSync(expectedPath)) {
      console.log(`Creating new snapshot for ${testName}`);
      await fs.copy(newPath, expectedPath);
    }

    const dreeOpts = {
      stat: false,
      sizeInBytes: true,
      size: false,
      hash: true,
      showHidden: true,
      sorted: true,
    };

    const actual = await dree.scanAsync(newPath, dreeOpts);
    const expected = await dree.scanAsync(expectedPath, dreeOpts);

    // Remove absolute paths
    const removePaths = (dirTree: any) => {
      replace(dirTree, (x: any) => {
        if (typeof x.path === "string") {
          const { path, ...theRest } = x;
          return [true, theRest];
        }
        return [false, null];
      });
    };

    removePaths(actual);
    removePaths(expected);

    actual.path = "";
    actual.name = "";
    actual.hash = undefined;
    expected.path = "";
    expected.name = "";
    expected.hash = undefined;

    if (!deepEqual(actual, expected)) {
      console.log(`${newPath} not equal to ${expectedPath}`);
      console.log("ACTUAL:");
      console.log(dree.parse(expectedPath));
      console.log("EXPECTED:");
      console.log(dree.parse(newPath));
      assertEquals(actual, expected);
    }
  });
}
