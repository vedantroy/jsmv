export function fatal(s: string) {
  console.error(s);
  Deno.exit(1);
}

export function assert(cond: () => boolean, s?: string) {
  if (!cond()) {
    console.error(
      `Assertion: "${cond.toString()}" failed.${s ? `Error: ${s}` : ""}`,
    );
    Deno.exit(1);
  }
}
