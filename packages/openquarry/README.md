# openquarry

Start a project in the [OpenQuarry](https://openquarry.dev/) format, add notes, lessons and courses, and check the files from the command line.

```bash
npm install openquarry
npx openquarry init my-notes
cd my-notes
npx openquarry check
```

OpenQuarry is an open format for knowledge bases and courses kept as Markdown. A note or a lesson is one Markdown file with YAML frontmatter, and folders group the files. This package includes the command and re-exports the validators and types from the library-only package, `@framers/openquarry`.

## Commands

| Command | What it does |
| --- | --- |
| `openquarry init [folder] [--template notes\|course] [--force]` | Starts a project from a template. |
| `openquarry new note\|lesson <title> [--in <folder>] [--slug <slug>]` | Writes a note or a lesson with its required keys filled in. |
| `openquarry new course <title> [--slug <slug>] [--subject <id>]` | Creates a course weave and adds its entry to the catalogue if present. |
| `openquarry check [folder]` | Validates project files and checks that the catalogue lists the weaves. |
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

Each template also carries `check.mjs`, its helper `check-input.mjs` and a `package.json` for projects that check with `npm run check` after `npm install`. Copy both scripts together when adding the check to an existing project. `npx openquarry check` runs without these files.

### new

```bash
npx openquarry new note "Scale and distance" --in weaves/notes/getting-started
npx openquarry new lesson "Reading contour lines" --in weaves/my-course/first-unit
```

`new note` and `new lesson` write one Markdown file with the five keys every thread needs, then a heading with the title:

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
- `--in` names the folder to write into; the default is the current folder. The folder must be inside the project's `weaves/` folder, the one beside its `fabric.yaml` or `catalogue.yaml`, because that is where `check` looks for notes and lessons. Every folder on the way down from `weaves/` must be one `check` reads: a real folder, not a link, whose name does not start with a dot and is not `node_modules`.
- A file that already exists is left as it is.

`new` writes no `license` or `publishing` key. Your notes and lessons are yours: state their licence yourself in `publishing.license`.

#### Add a course

Run `new course` from the project root.

```bash
npx openquarry new course "Reading contour lines"
```

The command creates `weaves/reading-contour-lines/weave.yaml` with `slug`, `title` and `kind: course`. Use `--slug` to choose the folder name. An existing manifest is left as it is.

When `catalogue.yaml` exists, pass `--subject <id>` with a subject it lists. The command appends an entry with that subject as its `home` and sole `subjects` member, and an empty `requires` list. It keeps the existing entry order and comments. If you omit the subject, the command lists the available IDs and leaves the files alone. If the catalogue lists no subjects, add one before creating the course.

### check

```bash
npx openquarry check
```

`check` validates `fabric.yaml`, `catalogue.yaml` and `blocks-index.json` at the top of the folder, and under `weaves/` every `weave.yaml`, every `loom.yaml` and the frontmatter of every Markdown file. Two threads may not share an `id`. Name a folder to check it from elsewhere: `openquarry check my-notes`.

The catalogue is optional. When it exists, `check` expects a unique slug for each weave, exactly one entry for each weave's manifest slug, and a matching weave for each entry. It reports each missing or unmatched slug on its own line. It also reports repeated subject IDs or entry slugs, links to unknown subjects or entries, a home outside the entry's subjects, and cycles in `broader` or `requires`.

It prints one line for each file, and under a file that is invalid one line for each problem. In a project made with `init`, after `version` is taken out of the first note:

```text
ok fabric.yaml
not ok weaves/notes/getting-started/first-note.md
  / must have required property 'version'
ok weaves/notes/getting-started/loom.yaml
ok weaves/notes/weave.yaml
1 of 4 files invalid.
```

A file that is not a plain file, such as a link that leads nowhere, is reported as `not ok` and is never read. It exits with 1 when a file is invalid, so the same command runs in CI.

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

The library's named exports are available from `openquarry` as an ES module and from CommonJS, with their TypeScript types.

```js
import { validateThreadFrontmatter } from 'openquarry'

const result = validateThreadFrontmatter({ slug: 'scale-and-distance', title: 'Scale and distance' })
// { valid: false, errors: ["/ must have required property 'id'", ...] }
```

The library-only package ships the schema files under `schema/`. [The package page](https://openquarry.dev/package/) lists every export with an example.

## Releases

Each version is published from [framerslab/openquarry](https://github.com/framerslab/openquarry) by its `release` workflow, with a provenance statement that links the version on npm to the commit and the run that built it. Versions after 0.3.0 publish through npm trusted publishing. 0.3.0, the first, went out with a token, because npm adds a trusted publisher only to a package that already exists. [The changelog](https://github.com/framerslab/openquarry/blob/master/packages/openquarry/CHANGELOG.md) lists what each version changed.

## Links

- [Start a project](https://openquarry.dev/package/#start) and [the format guide](https://openquarry.dev/format/) on openquarry.dev
- [Source on GitHub](https://github.com/framerslab/openquarry/tree/master/packages/openquarry) and [the changelog](https://github.com/framerslab/openquarry/blob/master/packages/openquarry/CHANGELOG.md)

## License

MIT, copyright Framers Lab, Inc. See [LICENSE](LICENSE). The licence covers this package. It does not cover the files you write in the format.
