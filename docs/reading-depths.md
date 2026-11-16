# Proposal: reading depths

**Proposal only.** OpenQuarry 0.3.0 does not define two depths of the same text. No schema change accompanies this proposal.

## What works today

A thread has `extractiveSummary` (pipeline summary), `aiSummary` (model summary), and the deprecated `summary` alias. Blocks have their own `extractiveSummary`. `difficulty` describes the thread's level. Typed relationships such as `summarizes`, `extends` and `refines` can connect separate threads. `teaches` and `requires` identify skills. These fields can help a reader select content; they do not specify which passages to hide.

## Proposed fields

Add an optional thread-level `overview` string: an author-written orientation to the whole thread. Add optional `depth` to each block with exactly three values:

- `core`: the essential explanation, shown first.
- `detail`: derivation, worked examples and further explanation, opened on request.
- `refresher`: prerequisite reminders, opened when needed.

A reader could show “Overview” followed by core blocks, with “Full explanation” revealing every block in source order. A new reader could choose the full explanation from the start. Depth is an editorial choice, independent of difficulty.

## Example: Scale and distance

This proposed metadata annotates passages in [the existing lesson](https://github.com/framerslab/openquarry/blob/master/examples/reading-a-map/weaves/reading-a-map/the-map/scale-and-distance.md). Line numbers below refer to the existing Markdown file including its frontmatter; a publisher must update ranges when editing. This is an illustrative metadata fragment, not a complete thread.

```yaml
overview: Turn a distance on the map into a distance on the ground.
blocks:
  - id: scale-rule
    line: 26
    endLine: 26
    type: paragraph
    depth: core
  - id: conversion
    line: 30
    endLine: 32
    type: paragraph
    depth: detail
  - id: scale-reminder
    line: 44
    endLine: 44
    type: paragraph
    depth: refresher
```

The core says what 1:25,000 means. The detail works through centimetres and metres. The refresher reminds the reader that a larger denominator makes a smaller drawing.

## Compatibility and decisions before adoption

Missing depth must mean core, so older content remains fully visible. Readers that do not understand depth must show the full Markdown. Never hide a warning or a necessary premise only in detail. Keep headings with their content and preserve document order, keyboard access, search and print access to every block.

The schema currently allows unknown properties in these objects; validation accepting a new key does not make it a supported format feature. Before adoption, agree on block identity and range maintenance, whether overview is plain text, how overlapping ranges behave, and how author annotations survive reindexing. Update the source schemas in framerslab/codex first, sync them here, then add types, tests and reader support. The example and the schemas carry none of these fields.
