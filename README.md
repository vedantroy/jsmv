# easymv

Re-organize files with Javascript.

## Samples

**Add the ".js" file extension to all files in a directory**

`jsmv exampledir 'f.mv(f + ".js")`

**Delete all backups and create new ones**

`jsmv src "f.endsWith('.backup') ? f.del() : f.mv(f + '.backup')"`

===

## How to Use

easymv runs a Javascript snippet on every file/directory in a given directory.

The command format is `jsmv dir_name snippet_or_file_name <FLAGS>`

You can either provide a JS snippet or a file that contains a JS snippet.

The JS snippet has access to the variable `f`. By default `f` is described by
the [defaultFileObj class](./defaultFileObj.ts). It's well commented.

_Entry_ = The current file/directory being operated on.

The rough summary:

- Use `del`, `mv`, and `cp` to manipulate the current entry.
- `f` extends `String` so `f + ".js"` will return "hello.js" if the current
  entry is "hello".

## --fileObj and JSMOVE_FILEOBJ_PATH

If you want `f` to have custom functionality you can implement your own
"FileObj" class. See [fileobj-examples](fileobj-examples).

`JSMOVE_FILEOBJ_PATH` is an optional environment variable to a file path with a
custom FileObj class. `--fileObj` overrides `JSMOVE_FILEOBJ_PATH`.

## Order of Operations

### Atomicity

Before any file system changes occur, jsmv will execute the JS snippet on all
files/directories in the given directory and collect a list of operations to
execute. This ensures changes are executed semi-atomically since if the JS
snippet crashes, no file system changes will occur.
