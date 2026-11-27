# Write a course as a folder of Markdown lessons

A course uses the same files as a knowledge base. The course is a weave, each unit is a loom, and each lesson, exercise and assessment is a thread. Set `kind: course` in `weave.yaml` and `kind: unit` in each unit's `loom.yaml` to mark them. Add a `catalogue.yaml` at the fabric's root to file courses under subjects. Both are optional.

| In a course | In the format | File | Checked by |
|---|---|---|---|
| course | a weave of kind `course` | `weaves/<course>/weave.yaml` | `validateWeave` |
| unit | a loom of kind `unit` | `weaves/<course>/<unit>/loom.yaml` | `validateLoom` |
| lesson | a thread whose `contentType` is `lesson` | `weaves/<course>/<unit>/<slug>.md` | `validateThreadFrontmatter` |
| exercise | a thread whose `contentType` is `exercise` | the same | the same |
| assessment | a thread whose `contentType` is `assessment` | the same | the same |
| what a lesson teaches and what it assumes | `teaches` and `requires`: lists of skill ids | the thread's frontmatter | `validateThreadFrontmatter` |
| courses by subject, and which course builds on which | the catalogue | `catalogue.yaml` at the fabric's root | `validateCatalogue` |

## The example course

[`examples/reading-a-map`](../examples/reading-a-map) is a course of six threads that teaches how to read a paper map.

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

The repository's tests validate every manifest and every thread of the example. They also check that each `slug` matches its file name, that no two threads share an `id`, that a lesson teaches every skill a thread requires and that every thread's subjects are in the catalogue ([test/example.test.ts](https://github.com/framerslab/openquarry/blob/master/test/example.test.ts)).

## The course is a weave of kind `course`

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

`kind` says what the weave is, in one lowercase word of letters, digits and hyphens that starts with a letter (`^[a-z][a-z0-9-]*$`). A course uses `course` on the weave and `unit` on each loom. A publisher may use its own noun, so `kind: field-guide` on a weave and `kind: week` on a loom pass too. A weave without `kind` is a knowledge base.

`license` states the license of the course's content. Set it in every course, as [the license of your content](#the-license-of-your-content) explains.

## Each unit is a loom of kind `unit`

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

## Lessons, exercises and assessments are threads

A lesson is a thread, the same kind of file as a note. `contentType` gives its teaching role: `lesson`, `exercise` or `assessment`. The example's lesson Scale and distance, in full:

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
| `publishing.license` | the license of this thread's content |

Below the frontmatter, the lesson is plain Markdown.

## `teaches` and `requires` hold skill ids

`teaches` lists the ids of the skills a thread teaches, and `requires` the ids of the skills it assumes. The publisher chooses each id. The example's ids look like `field-skills/skill/map-scale`, and the table gives the last part of each.

| Thread | `contentType` | `teaches` | `requires` |
|---|---|---|---|
| `what-a-map-shows` | `lesson` | `map-symbols` | |
| `scale-and-distance` | `lesson` | `map-scale` | `map-symbols` |
| `measure-a-walk` | `exercise` | | `map-scale` |
| `orient-the-map` | `lesson` | `orient-map` | `map-symbols` |
| `plan-a-route` | `exercise` | | `map-scale`, `orient-map` |
| `check-your-map-reading` | `assessment` | | `map-symbols`, `map-scale`, `orient-map` |

Order the threads from these lists: each thread goes after the lessons that teach what it requires.

The schema accepts any string as a skill id and never looks for the lesson that teaches a required skill. The example's test checks that some lesson of the course teaches each required skill. If your app orders lessons by skill, your build also checks that the teaching lesson comes first.

## The catalogue

The optional `catalogue.yaml` sits at the fabric's root, beside `fabric.yaml`. It files each weave under one or more subjects and records which weave builds on which.

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
| an entry's `slug` | the weave's slug, which another product uses to link to the course |
| an entry's `subjects` | the ids of every subject the weave sits under: at least one, each once |
| an entry's `home` | one of its `subjects`: where the weave is listed first |
| an entry's `requires` | the slugs of the entries this one builds on |

`catalogue.yaml` refuses any key its schema does not list, at every level. It holds no address and no count. Your app counts units and lessons from the files.

### Four rules the schema cannot hold

`catalogue.schema.yaml` checks the record's shape and that an entry lists each subject once. It states four more rules in words, because a JSON Schema cannot express them. `validateCatalogue` checks them once the shape passes.

| Rule | A line `validateCatalogue` gives |
|---|---|
| a subject id and an entry slug are each listed once | `/entries/2/slug is listed twice: "reading-a-map"` |
| a link names a subject or an entry the record lists | `/entries/0/subjects/1 names a subject the catalogue does not list: "geology"` |
| an entry's `home` is one of its `subjects` | `/entries/0/home must be one of the entry's subjects: "navigation"` |
| no chain of `broader` or `requires` links makes a circle | `/entries/0/requires makes a circle: "reading-a-map" > "night-navigation" > "reading-a-map"` |

An app that uses only the JSON Schema, in any language, has to check these four rules in its own code.

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

<a id="the-licence-of-your-content"></a>

## The license of your content

The MIT License of this package covers the schemas, the types, the validator, these docs and the example course. It does not cover what you write in the format. Record the license of your content in two keys.

- `license` in `weave.yaml`, for the course;
- `publishing.license` in a thread's frontmatter, for that thread.

Set both before you publish. The two schemas give `license` a default of `MIT` with JSON Schema's [`default` keyword](https://json-schema.org/draft/2020-12/json-schema-validation#section-9.2), and a tool that fills in defaults can write MIT into a missing key. The validator in this package fills in nothing. Content under another license names it, for example `CC-BY-4.0` or `All rights reserved`. The field takes any text.

## Files from 0.2.0, and apps built on it

The thread, fabric and blocks-index schemas of 0.3.0, the compatibility copy included, match 0.2.0 byte for byte, and `weave.schema.yaml` and `loom.schema.yaml` differ only by the optional `kind`. A file that validated under 0.2.0 validates under 0.3.0 with one exception. 0.2.0 accepted any value in a `kind` key on a weave or a loom, and 0.3.0 accepts only a lowercase word, so `kind: Course` and `kind: 3` fail and `kind: field-guide` passes.

The 0.2.0 weave and loom schemas accept a `kind` key they do not name, and 0.2.0 has no schema for `catalogue.yaml`. An app built on 0.2.0 reads a course as a knowledge base. The tests in `test/compat.test.ts` check each of these statements.
