#! /usr//bin/sh

./compile.sh
deno test --unstable --allow-read --allow-write --allow-run --import-map import_map.json tests/

