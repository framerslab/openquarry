# Version 1 compatibility

A **thread** is one Markdown note or lesson. Older OpenQuarry files called the same thing a **strand**.

## Writing and reading threads

New work uses `thread.schema.yaml`, `threadSchema` and `ThreadFrontmatter`. The deprecated `strandSchema` and `StrandFrontmatter` exports keep working, and the deprecated [`strand.schema` JSON Schema](https://openquarry.dev/schema/v1/strand.schema.json) and its [YAML source](https://openquarry.dev/schema/v1/strand.schema.yaml) stay at their published addresses.

A fabric without `fabric.yaml` reads as version 1. Readers of both versions accept the `looms/` and `strands/` prefix folders. `openquarry check` and the starter checks print a warning for a valid thread under either one.

```text
ok weaves/reading-a-map/looms/the-map/strands/scale-and-distance.md
  warning: Version 1 folder names in a version 2 fabric. Move the thread to weaves/<weave>/<loom>/<thread>.md.
```

A new fabric sets `format: openquarry` and `version: 2` in `fabric.yaml` and keeps each thread at a path such as `weaves/reading-a-map/the-map/scale-and-distance.md`. To move an older layout, move the files and update the paths that point at them in the same change. Keep each thread's `id`, and check its links after the move.

## Fields and stored values

`FabricNodeType` uses `'thread'` for new nodes. The deprecated `KnowledgeNodeType` keeps its original values, the stored value `'strand'` among them.

| Current blocks-index field | Deprecated alias | Where it appears |
| --- | --- | --- |
| `threads` | `strands` | Top-level index |
| `threadPath` | `strandPath` | Tag references |
| `stats.totalThreads` | `stats.totalStrands` | Index statistics |

A blocks index needs each renamed field under one of its two names. When it has both, both must pass the schema and the value under the thread name wins. A fabric manifest keeps every field its publisher writes.

`validateBlocksIndex` returns `{ valid, errors }`. With `{ normalize: true }` as the second argument, a valid index comes back as `value` under the thread names, with a warning when it used a strand name. The input object is left as it was. `openquarry check` and the starter checks print one deprecation line for each valid index that uses a strand name, with the names that replace them.

## When the aliases retire

The published schema addresses stay. The format accepts the strand fields, stored values, exports and folder names until a breaking release that documents the migration, and no date is set for one.
