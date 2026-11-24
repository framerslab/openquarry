# Version 1 compatibility

A **thread** is one Markdown note or lesson. Older OpenQuarry files called the same thing a **strand**.

## Writing and reading threads

Use `thread.schema.yaml`, `threadSchema` and `ThreadFrontmatter` in new work. An existing import of `strandSchema` or `StrandFrontmatter` keeps working as a deprecated alias. The published [compatibility JSON Schema](https://openquarry.dev/schema/v1/strand.schema.json) and [YAML source](https://openquarry.dev/schema/v1/strand.schema.yaml) carry the version 1 name.

A fabric without `fabric.yaml` reads as version 1. Version 1 and version 2 readers both accept the `looms/` and `strands/` prefix folders. The command and the starter checks issue an advisory for a valid thread under either folder.

```text
ok weaves/reading-a-map/looms/the-map/strands/scale-and-distance.md
  warning: Version 1 folder names in a version 2 fabric. Move the thread to weaves/<weave>/<loom>/<thread>.md.
```

For a new fabric use `format: openquarry` and `version: 2` in `fabric.yaml`, and put the thread at `weaves/reading-a-map/the-map/scale-and-distance.md`. To migrate an existing layout, move the files and update path references together. Keep the thread's ID and recheck its links after the move.

## Stored values and compiled indexes

`KnowledgeNodeType` retains the persisted value `'strand'` for a thread. A version 1 blocks index is a separate generated file containing metadata about threads. Its `strands` key maps thread paths to block data, `stats.totalStrands` counts indexed threads and `tagIndex` entries use `strandPath` to refer to one thread file.

`validateBlocksIndex` returns `{ valid, errors }` for version 1 indexes. The field names `strands`, `totalStrands` and `strandPath` are part of that wire contract. A future index version can define `threads`, `totalThreads` and `threadPath` once the index writer and readers have a migration path.

## When the aliases retire

Current authoring uses thread. The version 1 schema URLs and old folder names remain readable. Removing a reader alias requires a breaking format release with a documented migration. There is no scheduled removal date.
