# My course

A course kept in the [OpenQuarry](https://openquarry.dev/) format: Markdown lessons with YAML frontmatter, checked by [@framers/openquarry](https://www.npmjs.com/package/@framers/openquarry).

```bash
npm install
npm run check
```

`npm run check` validates `fabric.yaml`, `catalogue.yaml`, `blocks-index.json`, every `weave.yaml` and `loom.yaml`, and the frontmatter of every Markdown file under `weaves/`. It prints one line for each file and exits with 1 when a file is invalid, so the same command can run in CI.

## What is here

```text
fabric.yaml                                       the fabric: the format and its version
weaves/my-course/weave.yaml                       the course: a weave of kind course
weaves/my-course/first-unit/loom.yaml             a unit: a loom of kind unit
weaves/my-course/first-unit/first-lesson.md       a lesson: a thread whose contentType is lesson
check.mjs                                         the script behind npm run check
```

## Add a lesson

1. Copy `first-lesson.md` into a unit folder under a new name.
2. Give the copy its own `id`. This command prints one: `node -e "console.log(crypto.randomUUID())"`.
3. Change its `slug` and `title`. List the skills it teaches under `teaches`, and the skills it builds on under `requires`.
4. Run `npm run check`.

An exercise or an assessment is a thread too, with `contentType: exercise` or `contentType: assessment`. A new unit is a new folder under `weaves/my-course/` with a `loom.yaml` that holds its `slug`, its `title` and `kind: unit`.

## The licence of your course

`license` in `weave.yaml` and `publishing.license` in each lesson say `All rights reserved`. Change them to the licence you choose for your course.

## Read more

- [Courses and lessons](https://openquarry.dev/courses/)
- [The format guide](https://openquarry.dev/format/)
- [The schemas](https://openquarry.dev/schema/)
- [The package and its validators](https://openquarry.dev/package/)
- [An example course: Reading a map](https://github.com/framerslab/openquarry/tree/master/examples/reading-a-map)
