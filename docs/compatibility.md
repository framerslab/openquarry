# Version 1 compatibility

A **thread** is one Markdown note or lesson. Older OpenQuarry files called the same thing a **strand**.

## Writing and reading threads

Use `thread.schema.yaml`, `threadSchema` and `ThreadFrontmatter` in new work. An existing import of `strandSchema` or `StrandFrontmatter` keeps working as a deprecated alias. The published [compatibility JSON Schema](https://openquarry.dev/schema/v1/strand.schema.json) and [YAML source](https://openquarry.dev/schema/v1/strand.schema.yaml) carry the version 1 name.

A fabric with `version: 1`, or without `fabric.yaml`, can keep a thread under the older `looms/` and `strands/` directories. `openquarry check` reads the old path and issues an advisory without failing a valid file.

```text
ok weaves/reading-a-map/looms/the-map/strands/scale-and-distance.md
  warning: weaves/reading-a-map/looms/the-map/strands/scale-and-distance.md uses the version 1 thread layout. Use version 2 for new fabrics.
```

For a new fabric use `format: openquarry` and `version: 2` in `fabric.yaml`, and put the thread at `weaves/reading-a-map/the-map/scale-and-distance.md`. For an existing fabric, move the files and update path references together before changing the version. Keep the thread's ID and recheck its links after the move.

## Stored values and compiled indexes

`KnowledgeNodeType` retains the persisted value `'strand'` for a thread. A version 1 blocks index is a separate generated file containing metadata about threads. Its `strands` key maps thread paths to block data, `stats.totalStrands` counts indexed threads and `tagIndex` entries use `strandPath` to refer to one thread file.

`validateBlocksIndex` accepts those keys and returns advisory lines in `warnings`. Treat `valid` and `errors` as the validation result. The version 1 index’s field names remain part of its wire contract. A future index version can define `threads`, `totalThreads` and `threadPath` once the index writer and readers have a migration path.

## When the aliases retire

Current authoring uses thread. The version 1 schema URLs and old file layouts remain readable for version 1 content. Removing a reader alias requires a breaking format release with a documented migration. There is no scheduled removal date.
