# openquarry

Start a folder of notes or a course in the [OpenQuarry](https://openquarry.dev/) format, add notes and lessons, and check every file, from the command line.

```bash
npx openquarry init my-notes
cd my-notes
npx openquarry check
```

OpenQuarry is an open format for knowledge bases and courses kept as Markdown. A note or a lesson is one Markdown file with YAML frontmatter, and folders group the files. This package is the format's command. The validators and types are in [`@framers/openquarry`](https://www.npmjs.com/package/@framers/openquarry), which this package depends on and re-exports.

## Commands

| Command | What it does |
| --- | --- |
| `openquarry init [folder] [--template notes\|course] [--force]` | Starts a project from a template. |
| `openquarry new note\|lesson <title> [--in <folder>] [--slug <slug>]` | Writes a note or a lesson with its required keys filled in. |
| `openquarry check [folder]` | Validates every OpenQuarry file in a folder. |
| `openquarry id` | Prints a new UUID. |

`openquarry --help` prints this list and `openquarry --version` prints the version. The command runs on Node 18 or later.

### init

```bash
npx openquarry init my-notes
npx openquarry init my-course --template course
```

`init` copies a template into the folder you name, or into the current folder when you name none. It makes the folder when it is missing.

- `notes` is a knowledge base: a fabric manifest, one weave, one loom and a first note. It is the default.
- `course` is a weave of kind `course`, a loom of kind `unit` and a first lesson.

Both templates ship inside the package, so `init` works offline. It copies the files and stops: installing and checking are commands you run yourself.

A folder that already holds files is refused. With `--force`, `init` adds the files that are missing and keeps every file that is already there. It never overwrites a file. A folder that holds only `.git` counts as empty.

Each template also carries a `check.mjs` script and a `package.json`, for projects that check with `npm run check` after `npm install`. `npx openquarry check` needs neither.

### new

```bash
npx openquarry new note "Scale and distance" --in weaves/notes/getting-started
npx openquarry new lesson "Reading contour lines" --in weaves/my-course/first-unit
```

`new` writes one Markdown file with the five keys every thread needs, then a heading with the title:

```markdown
---
id: 8c0e6f1e-6d0b-4c5e-9a53-3f0f1f6a2b7d
slug: scale-and-distance
title: Scale and distance
version: 1.0.0
contentType: markdown
---

# Scale and distance
```

- `id` is a new UUID. `contentType` is `markdown` for a note and `lesson` for a lesson.
- The file is named after the slug: the title in lowercase letters, digits and hyphens. Pass `--slug` for another name, or when the title has no Latin letter or digit.
- `--in` names the folder to write into; the default is the current folder. The folder is inside a `weaves/` folder, because that is where `check` looks for notes and lessons.
- A file that already exists is left as it is.

`new` writes no `license` or `publishing` key. Your notes and lessons are yours: state their licence yourself in `publishing.license`.

### check

```bash
npx openquarry check
```

`check` validates `fabric.yaml` and `catalogue.yaml` at the top of the folder, and under `weaves/` every `weave.yaml`, every `loom.yaml` and the frontmatter of every Markdown file. Two threads may not share an `id`. Name a folder to check it from elsewhere: `openquarry check my-notes`.

It prints one line for each file, and under a file that is invalid one line for each problem:

```text
ok fabric.yaml
ok weaves/notes/getting-started/loom.yaml
not ok weaves/notes/getting-started/scale-and-distance.md
  / must have required property 'version'
ok weaves/notes/weave.yaml
1 of 4 files invalid.
```

It exits with 1 when a file is invalid, so the same command runs in CI.

### id

```bash
npx openquarry id
```

Prints a new UUID, for the `id` of a note or a lesson you write by hand.

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Done. |
| 1 | The command refused to go on or found a problem: an invalid file, a folder that is not empty, a file that is already there. |
| 2 | The command line is wrong: an unknown command or option, or a missing argument. |

A refusal is one line on standard error that says what is wrong and what to do. The report of `check` goes to standard output.

## Use it as a library

Every named export of `@framers/openquarry` is also an export of `openquarry`, as an ES module and from CommonJS, with its TypeScript types:

```js
import { validateThreadFrontmatter } from 'openquarry'

const result = validateThreadFrontmatter({ slug: 'scale-and-distance', title: 'Scale and distance' })
// { valid: false, errors: ["/ must have required property 'id'", ...] }
```

The schema files stay in the library: `@framers/openquarry/schema/thread.schema.yaml`. [The package page](https://openquarry.dev/package/) lists every export with an example.

## Links

- [Start a project](https://openquarry.dev/package/#start) and [the format guide](https://openquarry.dev/format/) on openquarry.dev
- [Source on GitHub](https://github.com/framerslab/openquarry/tree/master/packages/openquarry) and [the changelog](https://github.com/framerslab/openquarry/blob/master/packages/openquarry/CHANGELOG.md)
- [`@framers/openquarry`](https://www.npmjs.com/package/@framers/openquarry), the library

## License

MIT, copyright Framers Lab, Inc. See [LICENSE](LICENSE). The licence covers this package. It does not cover the files you write in the format.
