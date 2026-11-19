# Changelog

Every release of `@framers/openquarry`, newest first. The package follows semantic versioning.

The `openquarry` package, the command built on this library (`openquarry init`, `new`, `check` and `id`), keeps its own changelog: [packages/openquarry/CHANGELOG.md](https://github.com/framerslab/openquarry/blob/master/packages/openquarry/CHANGELOG.md). Its first release is 0.3.0, for the 0.3.0 format; this library is unchanged by it.

## 0.3.0

The course layer. A course is a weave of kind `course`, a unit is a loom of kind `unit`, and a catalogue files courses under subjects.

This release adds, and gives one key a meaning. A file that validated under 0.2.0 validates unchanged, with one exception: 0.2.0 let a weave or a loom carry a key named `kind` with any value, and 0.3.0 takes only a lowercase word there, so `kind: Course` or `kind: 3` is now refused. A file with no `kind` key, or with a lowercase word in it, validates as before. A reader built on 0.2.0 reads a course as a knowledge base.

### Added

- `kind` on `weave.schema.yaml` and `loom.schema.yaml`: an optional lowercase word (`^[a-z][a-z0-9-]*$`) that says what the weave or the loom is. The course layer's values are `course` on a weave and `unit` on a loom. The `Weave` and `Loom` types carry it.
- `catalogue.schema.yaml`: the record of an optional `catalogue.yaml` at a fabric's root. It lists subjects, each weave's home subject and other subjects, and which weave builds on which. The schema host serves it at `https://openquarry.dev/schema/v1/catalogue.schema.json` and `.yaml`, and lists it in the index with its hash.
- `validateCatalogue`, with the types `Catalogue`, `CatalogueSubject` and `CatalogueEntry` and the export `catalogueSchema`. It checks the record against the schema, then four rules a JSON Schema cannot hold: a subject id and an entry slug are each listed once, a link names a subject or an entry the record lists, an entry's `home` is one of its `subjects`, and no chain of links makes a circle.
- Two error lines. A closed record names the key it refuses: `/ must NOT have additional properties: "url"`. A list that holds a value twice names the place and the value: `/entries/0/subjects/1 is listed twice: "navigation"`.
- `examples/reading-a-map`: a small course as a fabric, with one weave of kind `course`, two looms of kind `unit`, three lessons, two exercises, an assessment and a catalogue. The tests validate every file of it.
- Docs: [Courses and lessons](docs/courses.md), [Writing OpenQuarry files with a language model](docs/language-models.md), and in the README the sections on courses, on language models, on who uses the format, and an FAQ. The package ships `docs/`, `examples/` and this file.

### Unchanged

- `thread.schema.yaml`, `strand.schema.yaml`, `fabric.schema.yaml` and `blocks-index.schema.yaml` are the files of 0.2.0, byte for byte.
- `weave.schema.yaml` and `loom.schema.yaml` differ from 0.2.0 by the `kind` property alone. Both still require only `slug` and `title`.
- Every validator and type of 0.2.0 keeps its name, and its result for every file but a weave or a loom whose `kind` is not a lowercase word. The error lines of 0.2.0 read the same.

## 0.2.0

- An error line for a value outside an `enum` or a `const` names the values the schema allows.

## 0.1.0

- The first release: the six schema files of the format, TypeScript types for each file, and the validators.
