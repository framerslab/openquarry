---
id: d314acd7-1a98-4089-9782-a1d3d6ed645e
slug: first-note
title: First note
summary: A note is one Markdown file with YAML frontmatter on top. This one shows the keys every note needs.
version: 1.0.0
contentType: markdown
taxonomy:
  subjects: [getting-started]
publishing:
  status: draft
  license: All rights reserved
---

# First note

A note is a thread: one Markdown file. The YAML between the two `---` lines at the top is its frontmatter, and the
text below it is the note.

## The keys every note needs

- `id`: a UUID. It stays the same when the file is renamed or moved, so links and histories keep pointing at the note.
- `slug`: the note's name in lowercase words joined by hyphens. Other notes link to it by this name.
- `title`: the title a reader sees.
- `version`: a version such as `1.0.0`.
- `contentType`: what the note is. `markdown` is a plain note; `reference`, `lesson` and `exercise` are among the
  others.

## The next note

Copy this file, give the copy its own `id` and change its `slug` and `title`. This command prints a new id:

```bash
node -e "console.log(crypto.randomUUID())"
```

Then run `npm run check`. It checks every file in the fabric and names any key that is missing or wrong.
