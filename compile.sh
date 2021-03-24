#! /usr/bin/sh
deno compile --unstable --allow-read --allow-write --allow-env --import-map import_map.json -o jsmv src/main.ts
