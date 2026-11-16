# OpenQuarry

OpenQuarry is an open format for knowledge bases and courses kept as Markdown. A note or a lesson is one Markdown file with YAML frontmatter. Folders group the files into looms, and looms into weaves: a weave is a knowledge base or a course. The files are plain text that a person can read and a language model can write, and JSON Schemas say what each file may hold.

This package holds the format's JSON Schemas, TypeScript types for every file the format defines, and a validator built on [Ajv](https://ajv.js.org/).

- [Read the format guide](https://openquarry.dev/format/), including current summaries and the proposed reading depths.
- [Courses and lessons](#courses-and-lessons): a course is a weave, a unit a loom, a lesson a thread. New in 0.3.0.
- [Written for people and for language models](#written-for-people-and-for-language-models): what makes the files easy for a model to write and for a program to check.
- [FAQ](#faq) and [changelog](CHANGELOG.md).

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
// contentType: essay gives the line
// '/contentType must be equal to one of the allowed values: "lesson", "reference", "exercise", "assessment", "project", "discussion", "resource", "markdown", "code", "data", "media"'
```

The validator takes parsed YAML, so bring the YAML parser your project already uses.

## A fabric on disk

```text
my-notes/                        a fabric: everything you keep
├── fabric.yaml                  optional manifest: format, name, version
├── catalogue.yaml               optional: the weaves by subject
└── weaves/
    └── programming/             a weave: a knowledge base or a course
        ├── weave.yaml
        ├── basics.md            a thread: a note or a lesson
        └── javascript/          a loom: a folder
            ├── loom.yaml
            ├── intro.md
            └── react/
                └── hooks.md
```

Looms nest to any depth. [Version 1 fabrics](#version-1-fabrics) describes the older layout.

## Levels, files and schemas

| Level | Plain word | File | Schema | Type |
|---|---|---|---|---|
| fabric | everything you keep | `fabric.yaml` (optional) | `fabric.schema.yaml` | `FabricManifest` |
| weave | a knowledge base or a course | `weaves/<slug>/weave.yaml` | `weave.schema.yaml` | `Weave` |
| loom | a folder or a unit | any folder in a weave, with an optional `loom.yaml` | `loom.schema.yaml` | `Loom` |
| thread | a note or a lesson | `<slug>.md` with frontmatter | `thread.schema.yaml` | `ThreadFrontmatter` |
| link | a connection | an entry under `relationships:` in frontmatter | inside `thread.schema.yaml` | `ThreadLink` |

A fabric may also hold `catalogue.yaml`, which files its weaves under subjects (`catalogue.schema.yaml`, type `Catalogue`).

`fabric.yaml` declares `format: openquarry` and a format version. New fabrics use version 2.

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

## Courses and lessons

A course is made of the files the format already has. A weave whose `weave.yaml` says `kind: course` is a course.

| In a course | In the format | File |
|---|---|---|
| course | a weave of kind `course` | `weaves/<course>/weave.yaml` |
| unit | a loom of kind `unit` | `weaves/<course>/<unit>/loom.yaml` |
| lesson, exercise, assessment | a thread whose `contentType` is `lesson`, `exercise` or `assessment` | `weaves/<course>/<unit>/<slug>.md` |
| what a lesson teaches and what it assumes | `teaches` and `requires`: lists of skill ids | the thread's frontmatter |
| courses by subject, and which course builds on which | the catalogue | `catalogue.yaml` at the fabric's root |

[`examples/reading-a-map`](examples/reading-a-map) is a small course in this shape: one weave, two units, three lessons, two exercises and an assessment, with its catalogue. The frontmatter of one of its lessons:

<!-- frontmatter: examples/reading-a-map/weaves/reading-a-map/the-map/scale-and-distance.md -->
```yaml
id: 70c967bf-2dba-4399-aef1-671174eb904f
slug: scale-and-distance
title: Scale and distance
summary: The scale says how much smaller the map is than the ground. With it, a length on the map becomes a distance you can walk.
version: 1.0.0
contentType: lesson
difficulty: beginner
taxonomy:
  subjects: [navigation]
  topics: [maps]
relationships:
  - target: what-a-map-shows
    type: follows
teaches:
  - field-skills/skill/map-scale
requires:
  - field-skills/skill/map-symbols
publishing:
  status: published
  license: MIT
```

The lesson teaches one skill, the map's scale, and assumes another, the map's symbols, which the lesson before it teaches. A reader can order a course's threads from those two lists.

`kind` is optional, and so is the catalogue. A fabric written for 0.2.0 validates unchanged unless a weave or a loom already used a key named `kind` for something other than a lowercase word. A reader built on 0.2.0 reads a course as a knowledge base. [Courses and lessons](docs/courses.md) shows every kind of file in the example, the catalogue's rules and the validator's error lines.

## Written for people and for language models

- **Plain files.** A thread is Markdown with a YAML block on top. A person edits it in any editor, and a model writes it as text.
- **Schemas at a stable address.** Each file's JSON Schema (draft 2020-12) is served at `https://openquarry.dev/schema/v1/<name>.json`, open to every origin, and the index beside them gives the SHA-256 of each schema's YAML source. The same rules reach the model, your code and any tool that reads JSON Schema.
- **Error lines a model can act on.** The validator returns one line for each problem: the path, then what is wrong. A value outside a list comes with the allowed values, and a refused key is named. The lines can go back to the model as they are.
- **Values from short lists.** `contentType`, `difficulty`, a link's `type` and `publishing.status` each take one value from a list in the schema.
- **Fields that say who wrote what.** `extractiveSummary` holds a summary made by a fixed pipeline, and `aiSummary` one written by a model. A suggested tag on a block carries its `source` (`inline`, `nlp`, `llm`, `existing` or `user`), a `confidence` and an optional `reasoning`.
- **Ids inside the file.** A thread's `id` is a UUID in its frontmatter, so it stays when the file is renamed or moved. Threads link to each other by slug and to skills by id.
- **Types.** TypeScript types for every file, for code that builds on what a model wrote.

Ask a model for a lesson with a prompt like this one:

```text
Write one OpenQuarry thread: a Markdown file that opens with YAML frontmatter between two lines of three hyphens.
Keys: id (use the UUID I give you), slug (lowercase words joined by hyphens), title, summary, version (1.0.0),
contentType (lesson), difficulty (beginner, intermediate, advanced or expert), teaches and requires (skill ids
from my list and no others), publishing (status: draft, and the licence I give you).
After the frontmatter, write the lesson in plain Markdown.
```

Then check the reply:

```ts
import { parse } from 'yaml'
import { validateThreadFrontmatter } from '@framers/openquarry'

const frontmatter = /^---\n([\s\S]*?)\n---\n/.exec(reply)?.[1] ?? ''
const { valid, errors } = validateThreadFrontmatter(parse(frontmatter))
// When valid is false, send the lines in errors back to the model and ask for the whole file again.
```

[Writing OpenQuarry files with a language model](docs/language-models.md) has the full prompt, a reply that passes, a reply that fails with its lines, and what the validator leaves for you to check.

## What the package exports

| Export | What it is |
|---|---|
| `validateThreadFrontmatter`, `validateLoom`, `validateWeave`, `validateFabricManifest`, `validateCatalogue`, `validateBlocksIndex` | validators that return `{ valid, errors }` |
| `ThreadFrontmatter`, `ThreadLink`, `ThreadLinkGroups`, `ThreadBlock`, `Loom`, `Weave`, `FabricManifest`, `Catalogue`, `CatalogueSubject`, `CatalogueEntry` | types for each file |
| `LinkType`, `ContentType`, `DifficultyLevel`, `KnowledgeNodeType`, `SkillReference` | value types |
| `threadSchema`, `loomSchema`, `weaveSchema`, `fabricSchema`, `catalogueSchema`, `blocksIndexSchema` | the JSON Schemas as objects |

`validateCatalogue` checks the record against its schema and then the rules a schema cannot hold: see [the catalogue](docs/courses.md#the-catalogue).

The YAML sources ship in the package too: `@framers/openquarry/schema/thread.schema.yaml` and its siblings, all JSON Schema draft 2020-12. So do the docs under `docs/` and the example course under `examples/`.

## Who uses it

- [Quarry](https://quarry.space), a reader and editor for knowledge kept in the format.

- [Quarry School](https://quarry.school), a site of free courses, maps each course to a weave of kind `course`, each unit to a loom of kind `unit` and each lesson to a thread. Its lessons are its own work under its own terms, and none of them is in this repository.
- [Frame Codex](https://github.com/framerslab/codex), the corpus repository the schema files come from, keeps its weaves in this format.

## Version 1 fabrics

New content uses thread names. Version 1 fabrics retain `strand.schema.yaml`, the deprecated `StrandFrontmatter` type and `strandSchema` export, the stored `'strand'` level in `KnowledgeNodeType`, and `looms/` and `strands/` folders. All remain supported. A fabric without `fabric.yaml` is version 1.

```text
weaves/reading-a-map/looms/the-map/strands/scale-and-distance.md
```

Version 2 uses `weaves/reading-a-map/the-map/scale-and-distance.md` with `thread.schema.yaml` and `ThreadFrontmatter`. The `relationships` and `notes` keys keep their names. The older schema URL, named `strand.schema` in the index, remains available unchanged. The team server SDK is a separate package.

## The schema host

The schemas are served from https://openquarry.dev, built in CI by `scripts/build-site.mjs` from the files this package ships:

| Address | What it is |
|---|---|
| `https://openquarry.dev/schema/v1/<name>.json` | the JSON Schema, with `$id` set to this address; otherwise the YAML file's content |
| `https://openquarry.dev/schema/v1/<name>.yaml` | the YAML source, byte for byte the file in `schema/` (its SHA-256 is in `schema/SOURCE.json`) |
| `https://openquarry.dev/schema/v1/index.json` | every schema with its addresses and hash, the corpus commit they came from, and this package's version |

`<name>` is one of `blocks-index.schema`, `catalogue.schema`, `fabric.schema`, `loom.schema`, `thread.schema` and `weave.schema`, plus the compatibility copy listed in Version 1 fabrics. Every address answers with `Access-Control-Allow-Origin: *`, so a page on any origin can fetch a schema. `openquarry.io`, `www.openquarry.io` and `www.openquarry.dev` redirect to the same path on `openquarry.dev`; the root serves the format’s landing page. OpenQuarry is a Framers Lab project.

## Keeping the schemas in step

The schema files come from the Frame Codex corpus repository, and a change to a schema is made there first. `schema/SOURCE.json` records the commit they were copied from and each file's SHA-256, and the tests fail when a file drifts from that record or from the generated `src/schemas.ts`. To take newer schemas: `node scripts/sync-schema.mjs <path to the corpus checkout>`.

## FAQ

### Is a lesson a different thing from a note?

No. Both are threads: one Markdown file with frontmatter, checked by the same schema. A lesson is a thread whose `contentType` is `lesson`. The same tools read both.

### What does a course add to a knowledge base?

Three things, each optional. `kind: course` on the weave and `kind: unit` on its looms tell a reader to show the weave as a course. `teaches` and `requires` on the threads say which skills each lesson teaches and assumes. The catalogue files courses under subjects and says which course builds on which.

### What does a product such as Quarry School add on top?

Everything a learner sees. The format stores a course as files and checks them. How a lesson is shown, practised, narrated or marked is the product's work.

### What licence covers the format, and what covers my content?

The format is under the MIT licence: the schemas, the types, the validator, the docs and the example course in this package. Your content is yours, under the licence you state in `license` (a weave) and `publishing.license` (a thread). State it: both schemas give `license` a default of `MIT`, so a tool that fills in defaults writes MIT where you left the key out. [The licence of your content](docs/courses.md#the-licence-of-your-content) has the detail.

### Can a language model write these files?

Yes. A thread is Markdown with a YAML block on top, and the validator's error lines can go back to the model as they are. See [written for people and for language models](#written-for-people-and-for-language-models).

### How do I validate a file?

Parse its YAML with your parser and call the validator of its kind: `validateThreadFrontmatter`, `validateLoom`, `validateWeave`, `validateFabricManifest` or `validateCatalogue`. Outside JavaScript, use any JSON Schema draft 2020-12 validator with the schemas from the host. Four of the catalogue's rules cannot be held by a schema, and such a reader checks them itself: [the catalogue](docs/courses.md#the-catalogue) lists them.

### Where are the schemas?

In this package under `schema/`, as YAML. At `https://openquarry.dev/schema/v1/`, as JSON with a `$id` and as the same YAML. Their source is `schema/` in the Frame Codex corpus repository, and `schema/SOURCE.json` records the commit and each file's SHA-256.

### What changed in 0.3.0, and does a 0.2.0 reader still read my files?

0.3.0 adds the course layer: an optional `kind` on the weave and the loom, the catalogue record with `validateCatalogue`, the example course and these docs. Four of the six schema files of 0.2.0 are unchanged byte for byte, and the weave and loom schemas gain `kind` alone. A file that validated under 0.2.0 validates under 0.3.0, with one exception: 0.2.0 took any value in a key named `kind` on a weave or a loom, and 0.3.0 takes only a lowercase word, so `kind: Course` is now refused. A reader built on 0.2.0 reads a course as a knowledge base. The [changelog](CHANGELOG.md) has the list.

### Do I need a catalogue?

No. A fabric with one course needs none. Add `catalogue.yaml` when you have several courses and want them listed under subjects, or when one course builds on another.

## License

MIT, copyright Framers Lab, Inc. See [LICENSE](LICENSE). The licence covers this package. It does not cover the files you write in the format: see the FAQ.

npm is a registered trademark of npm, Inc.
