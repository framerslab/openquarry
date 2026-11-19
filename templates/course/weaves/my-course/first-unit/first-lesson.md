---
id: 762b7f49-4399-427c-8e95-04803b68731e
slug: first-lesson
title: First lesson
summary: A lesson is one Markdown file with YAML frontmatter on top. This one shows the keys a lesson carries.
version: 1.0.0
contentType: lesson
difficulty: beginner
teaches:
  - my-course/skill/first-skill
publishing:
  status: draft
  license: All rights reserved
---

# First lesson

A lesson is a thread whose `contentType` is `lesson`. The YAML between the two `---` lines at the top is its
frontmatter, and the text below it is the lesson.

## The keys a lesson carries

- `id`: a UUID. It stays the same when the file is renamed or moved, so a learner's history keeps pointing at the
  lesson.
- `slug`, `title` and `version`: the lesson's name in lowercase words joined by hyphens, its title and its version.
- `contentType`: `lesson` for teaching text, `exercise` for practice, `assessment` for a test.
- `difficulty`: `beginner`, `intermediate`, `advanced` or `expert`.
- `teaches`: the ids of the skills this lesson teaches. You name the skills.

## The next lesson

Copy this file, give the copy its own `id` and change its `slug` and `title`. This command prints a new id:

```bash
node -e "console.log(crypto.randomUUID())"
```

When the next lesson builds on this one, list this lesson's skill under its `requires`:

```yaml
requires:
  - my-course/skill/first-skill
```

Then run `npm run check`. It checks every file in the course and names any key that is missing or wrong.
