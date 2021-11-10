import { fs, path } from "@deps.ts";

// Traverse an object & replace all values that
// match the replacer function.
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
          replace(v[i], process);
        } else replace(element, process);
      }
    } else replace(v, process);
  }
}
