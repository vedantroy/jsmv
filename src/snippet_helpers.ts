import { assert } from "./util.ts";

export function string_map(
  s: string,
  matcher: RegExp,
  f: (slice: string) => string,
): string {
  if (matcher instanceof RegExp) {
    if (!matcher.flags.includes("g")) {
      matcher = new RegExp(matcher.source, matcher.flags + "g");
    }

    const matches = [...s.matchAll(matcher)];
    let newString = "";
    let lastMatchEndPos = 0;
    for (const match of matches) {
      assert(() => typeof match.index === "number");
      newString += s.slice(newString.length, match.index);
      newString += f(match[0]);
      lastMatchEndPos = (match.index as number) + match[0].length;
    }

    if (lastMatchEndPos < s.length) {
      newString += s.slice(lastMatchEndPos);
    }

    return newString;
  } else {
    console.log(
      //@ts-ignore
      `Second argument to string_map must be RegExp. Got: ${matcher.constructor.name}`,
    );
    return "";
  }
}
