# Write lessons with a language model

An OpenQuarry file is plain text. A model can write it and the validator can check it. The prompt below asks for one lesson. The loop after it sends the validator's error lines back to the model for up to three more tries and rejects a reply that still fails.

## Parts of the format that help a model

| In the format | Why it matters to a model |
|---|---|
| A thread is Markdown with a YAML block on top | A model writes it as plain text, and a person can read and fix the reply in any editor |
| JSON Schemas at `https://openquarry.dev/schema/v1/<name>.json` | The model, your code and any tool that reads JSON Schema (draft 2020-12) work from the same rules. The index at `https://openquarry.dev/schema/v1/index.json` gives the SHA-256 of each schema's YAML source |
| One error line for each problem | The validator's lines can go back to the model as they are. Each gives the path and what is wrong. A value outside a list comes with the allowed values, and a refused key is named |
| Values from short lists | `contentType`, `difficulty`, a link's `type` and `publishing.status` each take one value from a list in the schema |
| Fields that say who wrote what | `extractiveSummary` holds a summary made by a fixed pipeline, and `aiSummary` one written by a model. A suggested tag on a block carries its `source` (`inline`, `nlp`, `llm`, `existing` or `user`), a `confidence` and an optional `reasoning` |
| Ids inside the file | A thread's `id` is a UUID in its frontmatter, so it stays when the file is renamed or moved. Threads link to each other by slug and to skills by id |

## What to give the model

1. **The keys and their rules.** The thread schema is long, because it also describes `blocks`, which an indexer writes. For a lesson, the keys in the prompt below are enough.
2. **An id made in code.** The schema asks for a UUID. Make it with `crypto.randomUUID()` and put it in the prompt, so no two threads share an id.
3. **Your skill ids.** `teaches` and `requires` take any string, so nothing stops a model from inventing an id. Give it your list and tell it to use no other.
4. **The license of your content**, for `publishing.license`, as [the license of your content](courses.md#the-license-of-your-content) explains.

## A prompt for one lesson

```text
Write one OpenQuarry thread. It is a Markdown file that opens with YAML frontmatter between two lines of three hyphens.

Frontmatter keys, in this order:
- id: 67cb69c0-3647-4418-8c3c-9f71d1b85532
- slug: lowercase words joined by hyphens
- title
- summary: one or two sentences
- version: 1.0.0
- contentType: lesson
- difficulty: beginner, intermediate, advanced or expert
- taxonomy: subjects: [navigation]
- teaches: a list of skill ids
- requires: a list of skill ids
- publishing: status: draft, and license: MIT

Use only these skill ids: field-skills/skill/map-symbols, field-skills/skill/map-scale, field-skills/skill/orient-map.

After the frontmatter, write the lesson in plain Markdown: a heading, the idea in plain words, one worked example and one common mistake.

The lesson: how the scale of a map turns a length on the map into a distance on the ground. It teaches map-scale and requires map-symbols.
```

A reply that passes:

<!-- reply: valid -->
```markdown
---
id: 67cb69c0-3647-4418-8c3c-9f71d1b85532
slug: scale-and-distance
title: Scale and distance
summary: The scale says how much smaller the map is than the ground. With it, a length on the map becomes a distance on the ground.
version: 1.0.0
contentType: lesson
difficulty: beginner
taxonomy:
  subjects: [navigation]
teaches:
  - field-skills/skill/map-scale
requires:
  - field-skills/skill/map-symbols
publishing:
  status: draft
  license: MIT
---

# Scale and distance

The scale says how much smaller the map is than the ground. At 1:25,000, 1 cm on the map is 250 m on the ground.

## Example

A path measures 6 cm on a 1:25,000 map. 6 cm x 250 m = 1,500 m, so the path is 1.5 km long.

## A common mistake

A bigger second number means a smaller drawing. A 1:50,000 map shows the same path at half the length.
```

## Check the reply and send the errors back

```ts
import { randomUUID } from 'node:crypto'
import { parse } from 'yaml'
import { validateThreadFrontmatter } from '@framers/openquarry'

/** The validator's lines for a reply. The list is empty when the frontmatter passes. */
function problems(reply: string): string[] {
  const found = /^---\n([\s\S]*?)\n---\n/.exec(reply)
  if (!found) return ['the reply does not open with frontmatter between two lines of three hyphens']
  try {
    return validateThreadFrontmatter(parse(found[1])).errors
  } catch (error) {
    return [`the frontmatter is not YAML: ${(error as Error).message}`]
  }
}

const prompt = lessonPrompt(randomUUID()) // the prompt above, with a fresh id
let reply = await ask(prompt) // your call to a model
for (let round = 0; round < 3 && problems(reply).length > 0; round++) {
  const lines = problems(reply).join('\n')
  reply = await ask(`${prompt}\n\nYour last reply failed these checks. Send the whole file again with them fixed.\n${lines}`)
}
if (problems(reply).length > 0) throw new Error(problems(reply).join('\n'))
```

`lessonPrompt` and `ask` are yours to write. The first builds the prompt, and the second calls the model you use.

A reply the validator refuses:

<!-- reply: refused -->
```markdown
---
id: b694ec65-cd49-41cc-b31d-92a869757327
slug: scale-and-distance
title: Scale and distance
version: 1.0
contentType: lecture
---

# Scale and distance
```

The lines it gives:

<!-- lines: refused -->
```text
/version must be string
/contentType must be equal to one of the allowed values: "lesson", "reference", "exercise", "assessment", "project", "discussion", "resource", "markdown", "code", "data", "media"
```

YAML reads `1.0` as a number, so the first line asks for a string. `1.0.0` fixes it. The second line lists the values `contentType` takes. Both lines go back to the model as they are.

## Write a whole course, one file at a time

Ask for one file at a time, and check each one with the validator for its kind.

| File | Ask for | Check with |
|---|---|---|
| `weave.yaml` | `slug`, `title`, `kind: course`, `description`, `license`, `tags` | `validateWeave` |
| `loom.yaml`, one for each unit | `slug`, `title`, `kind: unit`, `summary`, `ordering` | `validateLoom` |
| a thread for each lesson, exercise and assessment | the prompt above, with its `contentType` | `validateThreadFrontmatter` |
| `catalogue.yaml` | the subjects, and one entry for the course | `validateCatalogue` |

Plan the skills first. Ask the model for the list of skill ids and the lesson that teaches each, read the list yourself, then ask for each lesson with its ids fixed in the prompt. [The example course](../examples/reading-a-map) is small enough to put in a prompt as a pattern to follow, and [the courses guide](courses.md) explains each of its files.

## What the validator leaves to you

The validator checks frontmatter and manifests against their schemas, and the links inside `catalogue.yaml`. Four checks stay with your build and with a reviewer who knows the subject.

- Whether the lesson is right. A model can write a wrong lesson in a valid file, so a person who knows the subject reads it.
- Whether a thread's `slug` is its file name, and whether two threads share an `id`. `openquarry check` catches a shared `id`.
- Whether every skill a thread requires is taught by a lesson.
- Whether the target of a link exists.

[test/example.test.ts](https://github.com/framerslab/openquarry/blob/master/test/example.test.ts) makes the second and third checks for the example course.

## Have a model read a fabric

Give a model the frontmatter first and the bodies later. `title`, `contentType`, `difficulty`, `teaches` and `requires`, with a summary where the thread has one, say what a thread is and where it belongs in a course. `catalogue.yaml` lists the courses by subject in one small file. Then give the model the bodies of the threads it picks.
