# OpenQuarry

OpenQuarry is an open format for Markdown knowledge bases: folders of notes with YAML frontmatter, grouped into looms and weaves. This package holds the format's JSON Schemas, TypeScript types for every file the format defines, and a validator built on [Ajv](https://ajv.js.org/).

```bash
npm install @framers/openquarry
```

```ts
import { parse } from 'yaml'
import { validateThreadFrontmatter } from '@framers/openquarry'

const frontmatter = parse(`
id: 3fce914f-0801-45fd-b886-f0521aeeb4a1
slug: architecture-overview
title: Architecture overview
version: 1.0.0
contentType: reference
relationships:
  references: [nlp-pipeline, sql-cache-architecture]
`)

const result = validateThreadFrontmatter(frontmatter)
// { valid: true, errors: [] }
// A missing id gives { valid: false, errors: ["/ must have required property 'id'"] }
```

The validator takes parsed YAML, so bring the YAML parser your project already uses.

## A fabric on disk

```text
my-notes/                        a fabric: everything you keep
├── fabric.yaml                  optional manifest: format, name, version
└── weaves/
    └── programming/             a weave: a knowledge base
        ├── weave.yaml
        ├── basics.md            a thread: a note
        └── javascript/          a loom: a folder
            ├── loom.yaml
            ├── intro.md
            └── react/
                └── hooks.md
```

Looms nest to any depth. Older fabrics put threads under `looms/` and `strands/` folders (`weaves/programming/looms/javascript/strands/intro.md`); the format accepts both layouts.

## Levels, files and schemas

| Level | Plain word | File | Schema | Type |
|---|---|---|---|---|
| fabric | everything you keep | `fabric.yaml` (optional) | `fabric.schema.yaml` | `FabricManifest` |
| weave | a knowledge base | `weaves/<slug>/weave.yaml` | `weave.schema.yaml` | `Weave` |
| loom | a folder | any folder in a weave, with an optional `loom.yaml` | `loom.schema.yaml` | `Loom` |
| thread | a note | `<slug>.md` with frontmatter | `thread.schema.yaml` | `ThreadFrontmatter` |
| link | a connection | an entry under `relationships:` in frontmatter | inside `thread.schema.yaml` | `ThreadLink` |

`fabric.yaml` declares `format: openquarry` and a `version`: version 1 fabrics use the earlier file names (`strand.schema.yaml` and the `looms/` and `strands/` folders), version 2 fabrics use the thread names. A fabric without the manifest is a version 1 fabric.

### Stored names

Some names are part of saved data, and the format keeps them as they are:

- the frontmatter keys `relationships:` and `notes:`;
- the level value `'strand'` in `KnowledgeNodeType`, which a thread's stored records carry;
- the `looms/` and `strands/` folder names in version 1 fabrics.

## Threads

A thread's frontmatter needs `id` (a UUID), `slug`, `title`, `version` (semantic version) and `contentType`. The common optional keys:

| Key | Holds |
|---|---|
| `summary` | one or two sentences about the thread |
| `notes` | curated notes: a list, or one note as text |
| `difficulty` | `beginner`, `intermediate`, `advanced` or `expert`, or the scores object |
| `taxonomy` | `subjects` and `topics` lists |
| `relationships` | slugs grouped by kind (`prerequisites`, `requires`, `references`, `seeAlso`), or a list of typed links |
| `teaches`, `requires` | ids of the skills the thread teaches and assumes, for example `qs/library/skill/slope` |
| `publishing` | `status` (`draft`, `review`, `published`, `archived`), `license`, `lastUpdated` |
| `blocks` | per-block tags and suggested tags, written by the indexer |

A typed link carries a `target` slug (or `targetSlug`), a `type` such as `extends`, `supports` or `references` (the full list is `LinkType`), and an optional `strength` from 0 to 1.

## What the package exports

| Export | What it is |
|---|---|
| `validateThreadFrontmatter`, `validateLoom`, `validateWeave`, `validateFabricManifest`, `validateBlocksIndex` | validators that return `{ valid, errors }` |
| `ThreadFrontmatter`, `ThreadLink`, `ThreadLinkGroups`, `ThreadBlock`, `Loom`, `Weave`, `FabricManifest` | types for each file |
| `LinkType`, `ContentType`, `DifficultyLevel`, `KnowledgeNodeType`, `SkillReference` | value types |
| `threadSchema`, `loomSchema`, `weaveSchema`, `fabricSchema`, `blocksIndexSchema`, `strandSchema` | the JSON Schemas as objects |

The YAML sources ship in the package too: `@framers/openquarry/schema/thread.schema.yaml` and its siblings, all JSON Schema draft 2020-12.

## Migrating from openstrand-sdk

`@framers/openstrand-sdk` is the TypeScript client of the OpenStrand team server's API. The note format behind it is OpenQuarry, and its types and schemas live in this package:

| In OpenStrand | In OpenQuarry |
|---|---|
| `strand.schema.yaml`, title `StrandFrontmatter` | `thread.schema.yaml`, title `ThreadFrontmatter`; `strand.schema.yaml` ships as an identical copy for one major version |
| the `StrandFrontmatter` type | `ThreadFrontmatter`; `StrandFrontmatter` remains as a deprecated alias |
| strand (a note) | thread; the stored level value stays `'strand'` |
| `weave.yaml`, `loom.yaml`, `looms/`, `strands/` | unchanged, and read in both layouts |

The team server's API client (`OpenStrandSDK` and its request and response types) is not part of this package.

## Keeping the schemas in step

The schema files come from the Frame Codex corpus repository. `schema/SOURCE.json` records the commit they were copied from and each file's SHA-256, and the tests fail when a file drifts from that record or from the generated `src/schemas.ts`. To take newer schemas: `node scripts/sync-schema.mjs <path to the corpus checkout>`.

## License

MIT, copyright Framers Lab, Inc.
