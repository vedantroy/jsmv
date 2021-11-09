# jsmv

Re-organize files with Javascript. Uses Deno.
[Download](https://github.com/vedantroy/jsmv/releases/tag/0.1)

## Samples

**Add the ".js" extension to all entries in a directory**\
`jsmv exampledir 'f.mv(f + ".js")`

**Add the ".js" file extension to all files in a directory**\
`jsmv exampledir 'if (f.isFile) f.mv(f + ".js")`

**Delete all backups and create new ones**\
`jsmv src "f.endsWith('.backup') ? f.del() : f.mv(f + '.backup')"`

**Number files**\
`jsmv src "f.mv(ctx.i++ + '.js')" --ctx "{i: 0}"`

Look at the [e2e tests](./tests/e2e) for more examples.

## How to Use

jsmv runs a Javascript snippet on every file/directory in a given directory.

The command format is `jsmv dir_name snippet_or_file_name <FLAGS>`

You can either provide a JS snippet or a file that contains a JS snippet.

The JS snippet has access to the variable `f`. By default `f` is described by
the [defaultFileObj class](./defaultFileObj.ts). It's well commented. There's
also `ctx` which is a variable that is persistent between every execution of the
snippet. It is possible to add/delete properties on `ctx`, but re-assignment is
impossible.

_Entry_ = The current file/directory being operated on.

The rough summary:

- Use `del`, `mv`, and `cp` to manipulate the current entry.
- Use instance variables like `path`, `dirname`, `name`, `isDir`, and `isFile`
  to get useful info.
- `f` extends `String` so `f + ".js"` will return "hello.js" if the current
  entry is "hello".

## --fileObj and JSMOVE_FILEOBJ_PATH

If you want `f` to have custom functionality you can implement your own
"FileObj" class. See [fileobj-examples](fileobj-examples).

`JSMOVE_FILEOBJ_PATH` is an optional environment variable to a file path with a
custom FileObj class. `--fileObj` overrides `JSMOVE_FILEOBJ_PATH`.

## --ctx and JSMOVE_CTX

`--ctx` is a snippet of JS-object-notation (e.g `{foo: "bar"}`) that will be
executed to create the initial context. Without it, the initial context is
empty.

`JSMOVE_CTX` operates similarly to `JSMOVE_FILEOBJ_PATH` except it's not a path.

### Guidelines

All custom FileObj classes should implement the `getOp` operation. File system
operations should not be done directly inside the FileObj class. Rather, an `Op`
should be returned by `getOp`. This has several benefits:

- Atomicity (explained [here](#Atomicity))
- jsmv can do checks like
  - ensuring files are only deleted if `-d` is passed
  - ensuring moves don't overwrite files unless `-o` is passed

## Order of Operations

### Atomicity

Before any file system changes occur, jsmv will execute the JS snippet on all
files/directories in the given directory and collect a list of operations to
execute. This ensures changes are executed semi-atomically since if the JS
snippet crashes, no file system changes will occur.

### Deletes First

Deletes are done before moves/copies. This allows operations like "remove all
files with the extension .backup and add the .backup extension to the remaining
files" without accidentally deleting the newly created backups.
