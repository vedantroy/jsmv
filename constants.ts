export const HELP_MSG = `
Usage: [binary_name] directory snippet_or_file <FLAGS> [--fileobj=<file>]

FLAGS:
-h, --help:      Show this message
-d, --delete:    Delete the file if the rename function returns null
-p, --preview:   Show a preview of the changes instead of executing them
-r, --recursive  Recurse on all sub-directories
-q, --quiet      Don't print unless there's an error
-o, --overwrite  Allow overwriting files with the copy or move operations
--file           A file with a custom "FileObj" class
`;
