import { getFolderStructure } from "./utils.ts";
import { assertEquals, fs, path } from "@deps.ts";

const __dirname = path.dirname(path.fromFileUrl(import.meta.url));

const e2eTestsDir = path.join(__dirname, "e2e");
const e2eTests = Deno.readDirSync(e2eTestsDir);
for (const entry of e2eTests) {
  const testName = `e2e: ${entry.name}`;
  Deno.test(testName, async () => {
    const entryPath = path.resolve(e2eTestsDir, entry.name);
    const oldPath = path.resolve(entryPath, "base");
    const newPath = path.resolve(entryPath, "temp");
    await fs.emptyDir(newPath);
    await fs.copy(oldPath, newPath, { overwrite: true });

    const cmdInfo = JSON.parse(
      await Deno.readTextFile(path.join(entryPath, "cmd.json")),
    );
    const cmd = `./jsmv ${newPath} ${cmdInfo.params}`;
    const proc = await Deno.run({ cmd: ["./jsmv", newPath, cmdInfo.params] });
    const status = await proc.status();
    if (!status.success) {
      throw new Error(
        `Command: ${cmd} failed`,
      );
    }
    const structure = getFolderStructure(newPath);
    const expectedPath = path.join(entryPath, "expected.json");
    if (!fs.existsSync(expectedPath)) {
      console.log(`Creating new snapshot for ${testName}`);
      const stringified = JSON.stringify(structure, null, 2);
      console.log(stringified);
      await Deno.writeTextFile(expectedPath, stringified);
    }
    const expected = JSON.parse(
      await Deno.readTextFile(expectedPath),
    );
    assertEquals(structure, expected);
    // https://github.com/denoland/deno/issues/9885
    Deno.close(4);
  });
}
