# Changelog

Every release of `openquarry`, newest first. The package's major and minor version follow `@framers/openquarry`, the library it depends on; its patch number is its own.

## 0.3.0

The first release: the `openquarry` command, for the 0.3.0 format.

- `openquarry init [folder] [--template notes|course] [--force]` starts a project from a template bundled in the package. It refuses a folder that is not empty unless `--force`, and never overwrites a file.
- `openquarry new note|lesson <title> [--in <folder>] [--slug <slug>]` writes a Markdown file with a new `id`, a `slug` from the title, `version: 1.0.0` and its `contentType`. It writes no licence.
- `openquarry check [folder]` validates `fabric.yaml`, `catalogue.yaml` and every `weave.yaml`, `loom.yaml` and Markdown file under `weaves/`, prints one line for each file and exits with 1 when a file is invalid.
- `openquarry id` prints a new UUID.
- The package re-exports every named export of `@framers/openquarry` `^0.3.0`, as an ES module and from CommonJS, with its types.
