# Version 1 compatibility

A **thread** is one Markdown note or lesson. Older OpenQuarry files called the same thing a **strand**.

## Writing and reading threads

Use `thread.schema.yaml`, `threadSchema` and `ThreadFrontmatter` in new work. The deprecated `strandSchema` and `StrandFrontmatter` exports still work. The deprecated [`strand.schema` JSON Schema](https://openquarry.dev/schema/v1/strand.schema.json) and its [YAML source](https://openquarry.dev/schema/v1/strand.schema.yaml) remain available at their published addresses.

A fabric without `fabric.yaml` reads as version 1. Version 1 and version 2 readers both accept the `looms/` and `strands/` prefix folders. The command and the starter checks issue an advisory for a valid thread under either folder.

```text
ok weaves/reading-a-map/looms/the-map/strands/scale-and-distance.md
  warning: Version 1 folder names in a version 2 fabric. Move the thread to weaves/<weave>/<loom>/<thread>.md.
```

For a new fabric use `format: openquarry` and `version: 2` in `fabric.yaml`, and put the thread at `weaves/reading-a-map/the-map/scale-and-distance.md`. To migrate an existing layout, move the files and update path references together. Keep the thread's ID and recheck its links after the move.

## Fields and stored values

`KnowledgeNodeType` uses `'thread'` for new nodes and still accepts the deprecated stored value `'strand'`.

| Current field | Deprecated alias | Where it appears |
| --- | --- | --- |
| `thread` | `strand` | Fabric manifest |
| `threads` | `strands` | Fabric manifest and blocks index |
| `threadPath` | `strandPath` | Fabric manifest and blocks-index tag references |
| `stats.totalThreads` | `stats.totalStrands` | Blocks index |

The blocks index requires either spelling of each renamed field. When both are present, both must satisfy the schema and the current value wins. Fabric fields in the table are optional and retain their publisher-defined values. When both names are present in a fabric manifest, the current value wins there too.

`validateBlocksIndex` and `validateFabricManifest` return `{ valid, errors }` by default. Pass `{ normalize: true }` as the second argument to get a valid input back as `value` with current keys and a warning when it used deprecated fields. The input stays intact. `openquarry check` and the starter checks print one field deprecation line per valid file, naming the replacements.

## When the aliases retire

The published schema URLs remain available. The format accepts the old fields, values, exports and folder names until a breaking format release with a documented migration. There is no scheduled removal date.
