# Courses and lessons

A course in OpenQuarry is made of the files the format already has. A course is a weave. A unit is a loom. A lesson, an exercise and an assessment are threads. Version 0.3.0 adds two things, so that a reader can tell a course from a knowledge base and list courses by subject: an optional `kind` on the weave and the loom, and one optional file, `catalogue.yaml`.

| In a course | In the format | File | Checked by |
|---|---|---|---|
| course | a weave of kind `course` | `weaves/<course>/weave.yaml` | `validateWeave` |
| unit | a loom of kind `unit` | `weaves/<course>/<unit>/loom.yaml` | `validateLoom` |
| lesson | a thread whose `contentType` is `lesson` | `weaves/<course>/<unit>/<slug>.md` | `validateThreadFrontmatter` |
| exercise | a thread whose `contentType` is `exercise` | the same | the same |
| assessment | a thread whose `contentType` is `assessment` | the same | the same |
| what a lesson teaches and what it assumes | `teaches` and `requires`: lists of skill ids | the thread's frontmatter | `validateThreadFrontmatter` |
| courses by subject, and which course builds on which | the catalogue | `catalogue.yaml` at the fabric's root | `validateCatalogue` |

On this page: [the example](#the-example), [the course](#the-course-a-weave-of-kind-course), [a unit](#a-unit-a-loom-of-kind-unit), [lessons, exercises and assessments](#lessons-exercises-and-assessments-threads), [skills](#skills-teaches-and-requires), [the catalogue](#the-catalogue), [check a course](#check-a-course), [the licence of your content](#the-licence-of-your-content), [what a 0.2.0 reader sees](#what-a-020-reader-sees).

## The example

[`examples/reading-a-map`](../examples/reading-a-map) is a small course written for this page. It teaches how to read a paper map.

```text
examples/reading-a-map/                     a fabric
├── fabric.yaml
├── catalogue.yaml                          the course under its subject
└── weaves/
    └── reading-a-map/                      the course
        ├── weave.yaml                      kind: course
        ├── the-map/                        unit 1
        │   ├── loom.yaml                   kind: unit
        │   ├── what-a-map-shows.md         lesson
        │   ├── scale-and-distance.md       lesson
        │   └── measure-a-walk.md           exercise
        └── finding-your-way/               unit 2
            ├── loom.yaml                   kind: unit
            ├── orient-the-map.md           lesson
            ├── plan-a-route.md             exercise
            └── check-your-map-reading.md   assessment
```

The tests of this repository run every file of the example through its validator and check the links between the files ([test/example.test.ts](https://github.com/framerslab/openquarry/blob/master/test/example.test.ts)).

## The course: a weave of kind `course`

<!-- file: examples/reading-a-map/weaves/reading-a-map/weave.yaml -->
```yaml
slug: reading-a-map
title: Reading a map
kind: course
description: >-
  A short course on reading a paper map. It covers what a map shows, how its scale works and how to plan a walk with it.
maintainedBy: OpenQuarry examples
license: MIT
tags: [maps, navigation]
```

`kind` says what the weave is. It is one lowercase word: letters, digits and hyphens, starting with a letter (`^[a-z][a-z0-9-]*$`). The course layer's two values are `course` on a weave and `unit` on a loom. The field holds a publisher's own noun, so `kind: field-guide` on a weave and `kind: week` on a loom pass too. A weave without `kind` is a knowledge base, as before.

`license` states the licence of the course's content. Write it: see [the licence of your content](#the-licence-of-your-content).

## A unit: a loom of kind `unit`

<!-- file: examples/reading-a-map/weaves/reading-a-map/finding-your-way/loom.yaml -->
```yaml
slug: finding-your-way
title: Finding your way
kind: unit
summary: Turn the map to match the ground, then plan a walk with it.
ordering: manual
relationships:
  - targetSlug: the-map
    type: extends
```

A unit is a folder inside the course's folder, with a `loom.yaml`. The link of type `extends` says this unit builds on the unit whose slug is `the-map`. `ordering` takes `manual`, `alpha`, `date` or `weight`.

## Lessons, exercises and assessments: threads

A lesson is a thread, the same kind of file a note is. `contentType` names its teaching role: `lesson`, `exercise` or `assessment`. One lesson of the example, whole:

<!-- file: examples/reading-a-map/weaves/reading-a-map/the-map/scale-and-distance.md -->
```markdown
---
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
---

# Scale and distance

The scale says how much smaller the map is than the ground. A scale of 1:25,000 means that one unit on the map is 25,000 of the same unit on the ground.

## From the map to the ground

At 1:25,000, 1 cm on the map is 25,000 cm on the ground. That is 250 m. So 4 cm on the map is 1 km.

At 1:50,000, 1 cm on the map is 500 m on the ground, and 2 cm is 1 km.

## Example

A path measures 6 cm on a 1:25,000 map.

6 cm x 250 m = 1,500 m

The path is 1.5 km long.

## A common mistake

A bigger second number means a smaller drawing. A 1:50,000 map shows the same path at half the length a 1:25,000 map gives it.
```

| Key | In this lesson |
|---|---|
| `id` | a UUID. It stays when the file is renamed or moved |
| `slug` | the file's name without `.md` |
| `version` | three numbers, as in `1.0.0` |
| `contentType` | `lesson`. The two exercises of the example say `exercise`, and its last thread says `assessment` |
| `taxonomy.subjects` | the subject the lesson is filed under. The example uses the subject ids of its catalogue |
| `relationships` | a link of type `follows` to the lesson that comes before this one in the unit |
| `teaches`, `requires` | the skills the lesson teaches and assumes |
| `publishing.license` | the licence of this thread's content |

Below the frontmatter, the lesson is plain Markdown.

## Skills: `teaches` and `requires`

`teaches` lists the ids of the skills a thread teaches. `requires` lists the ids of the skills it assumes. A skill id is a string the publisher chooses. The example's ids look like `field-skills/skill/map-scale`, and the table gives the last part of each:

| Thread | `contentType` | `teaches` | `requires` |
|---|---|---|---|
| `what-a-map-shows` | `lesson` | `map-symbols` | |
| `scale-and-distance` | `lesson` | `map-scale` | `map-symbols` |
| `measure-a-walk` | `exercise` | | `map-scale` |
| `orient-the-map` | `lesson` | `orient-map` | `map-symbols` |
| `plan-a-route` | `exercise` | | `map-scale`, `orient-map` |
| `check-your-map-reading` | `assessment` | | `map-symbols`, `map-scale`, `orient-map` |

A reader can order the threads from these lists: a thread comes after the lessons that teach what it requires.

The schema takes any string as a skill id, and it does not look for the lesson that teaches a required skill. The example's test checks that every required skill is taught by a lesson of the course. A check like it belongs in your own build.

## The catalogue

`catalogue.yaml` sits at the fabric's root, beside `fabric.yaml`. It is optional. It files each weave under one or more subjects and says which weave builds on which.

<!-- file: examples/reading-a-map/catalogue.yaml -->
```yaml
id: field-skills
title: Field skills
subjects:
  - id: outdoors
    title: Outdoors
    broader: []
  - id: navigation
    title: Navigation
    broader: [outdoors]
entries:
  - slug: reading-a-map
    home: navigation
    subjects: [navigation]
    requires: []
```

| Key | Holds |
|---|---|
| `id` | the catalogue's own id |
| `title` | the publisher's name for the whole catalogue |
| `subjects` | the subject tree, in the publisher's order. Each subject has an `id`, a `title` and `broader`: the ids of the subjects it sits under, empty at the top of the tree |
| `entries` | one entry for each weave, in the publisher's order |
| an entry's `slug` | the weave's slug. Another product links to the course by it |
| an entry's `subjects` | the ids of every subject the weave sits under: at least one, each once |
| an entry's `home` | one of its `subjects`: where the weave is listed first |
| an entry's `requires` | the slugs of the entries this one builds on |

The record is closed: at every level it refuses a key it does not name. It holds no address and no count, so a reader counts units and lessons from the files.

### The rules a schema cannot hold

`catalogue.schema.yaml` checks the record's shape, and that an entry lists each subject once. It states four more rules in words, because a JSON Schema cannot hold them. `validateCatalogue` checks them once the shape passes:

| Rule | A line `validateCatalogue` gives |
|---|---|
| a subject id and an entry slug are each listed once | `/entries/2/slug is listed twice: "reading-a-map"` |
| a link names a subject or an entry the record lists | `/entries/0/subjects/1 names a subject the catalogue does not list: "geology"` |
| an entry's `home` is one of its `subjects` | `/entries/0/home must be one of the entry's subjects: "navigation"` |
| no chain of `broader` or `requires` links makes a circle | `/entries/0/requires makes a circle: "reading-a-map" > "night-navigation" > "reading-a-map"` |

A reader that checks the record with the schema alone, in any language, checks these four itself.

## Check a course

```ts
import { parse } from 'yaml'
import { validateCatalogue, validateLoom, validateThreadFrontmatter, validateWeave } from '@framers/openquarry'

validateWeave(parse(weaveYaml)) // { valid: true, errors: [] }
validateLoom(parse(loomYaml))
validateThreadFrontmatter(parse(frontmatter))
validateCatalogue(parse(catalogueYaml)) // the shape, then the four rules
```

Each call returns `{ valid, errors }`, with one line for each problem. A weave whose kind is `Course` gives the line `/kind must match pattern "^[a-z][a-z0-9-]*$"`.

## The licence of your content

The MIT licence of this package covers the format: the schemas, the types, the validator, these docs and the example course. It does not cover what you write in the format. Your course is yours, under the licence you state:

- `license` in `weave.yaml`, for the course;
- `publishing.license` in a thread's frontmatter, for that thread.

Write both. The two schemas give `license` a default of `MIT` with JSON Schema's [`default` keyword](https://json-schema.org/draft/2020-12/json-schema-validation#section-9.2), so a tool that fills in defaults writes MIT where you left the key out. The validator in this package fills in nothing. If your content is not under the MIT licence, say what it is under, for example `CC-BY-4.0` or `All rights reserved`. The field takes any text.

## What a 0.2.0 reader sees

Version 0.3.0 only adds. `thread.schema.yaml`, `strand.schema.yaml`, `fabric.schema.yaml` and `blocks-index.schema.yaml` are the files of 0.2.0, byte for byte. `weave.schema.yaml` and `loom.schema.yaml` gain the optional `kind` and change in no other byte. A file that validated under 0.2.0 validates under 0.3.0.

A reader built on 0.2.0 reads a course as a knowledge base: the weave and loom schemas of 0.2.0 refuse no key they do not name, so `kind` passes. It has no schema for `catalogue.yaml`. The tests in `test/compat.test.ts` hold each of these statements.
