# Keeping a catalogue

The optional `catalogue.yaml` at the project root lists weaves by subject and records prerequisites. If you keep a catalogue, it needs one entry for each weave under `weaves/`. The `slug` in `weave.yaml` identifies the weave, even when its folder has a different name. See [the catalogue fields](courses.md#the-catalogue).

## Add a course

Run the command from the project root. If the catalogue lists a subject with ID `navigation`, for example, run:

```bash
npx openquarry new course "Reading contour lines" --subject navigation
```

The command validates and creates `weaves/reading-contour-lines/weave.yaml` with `slug`, `title` and `kind: course`. Pass `--slug` to choose the slug. An existing weave manifest is left as it is.

The command appends a catalogue entry with `home: navigation`, `subjects: [navigation]` and `requires: []`, keeping the order and comments of existing entries. If you leave out `--subject` or give an unknown ID, it lists the available subject IDs and leaves the files alone. Add a subject first if the catalogue has none. If your project has no catalogue, omit `--subject` and the command creates just the weave manifest.

## Check a project

```bash
npx openquarry check
```

The check reports catalogue problems under `not ok catalogue.yaml`, one line per problem. A weave missing from the catalogue needs an entry with its slug. An entry without a matching weave needs a corresponding `weave.yaml` under `weaves/`, or you can remove the stale entry. The check also reports repeated subject IDs and entry slugs, unknown links, a home outside an entry's subjects, and cycles in subject or prerequisite links. Any of these errors makes the command exit with status 1.

The command still checks individual project files when there is no catalogue.
