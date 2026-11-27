# My notes

Notes kept in the [OpenQuarry](https://openquarry.dev/) format: Markdown files with YAML frontmatter, checked by [@framers/openquarry](https://www.npmjs.com/package/@framers/openquarry).

```bash
npm install
npm run check
```

`npm run check` validates `fabric.yaml`, `catalogue.yaml`, `blocks-index.json`, every `weave.yaml` and `loom.yaml`, and the frontmatter of every Markdown file under `weaves/`. It prints one line for each file and exits with 1 when a file is invalid, so the same command can run in CI.

## What is here

```text
fabric.yaml                                   the fabric: the format and its version
weaves/notes/weave.yaml                       a weave: this knowledge base
weaves/notes/getting-started/loom.yaml        a loom: a folder of notes
weaves/notes/getting-started/first-note.md    a thread: one note
check.mjs                                     the script behind npm run check
```

## Add a note

1. Copy `first-note.md` into a loom folder under a new name.
2. Give the copy its own `id`. This command prints one: `node -e "console.log(crypto.randomUUID())"`.
3. Change its `slug` and `title`, then write the note.
4. Run `npm run check`.

A new loom is a new folder under `weaves/notes/` with a `loom.yaml` that holds its `slug` and `title`.

## The licence of your notes

`license` in `weave.yaml` and `publishing.license` in each note say `All rights reserved`. Change them to the licence you choose for your notes.

## Read more

- [The format guide](https://openquarry.dev/format/)
- [The schemas](https://openquarry.dev/schema/)
- [The package and its validators](https://openquarry.dev/package/)
- [An example course](https://github.com/framerslab/openquarry/tree/master/examples/reading-a-map)
