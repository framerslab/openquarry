# A proposal for reading depths

This is a proposal. The 0.3 schemas have no field for two depths of the same text, and the proposal changes no schema.

## Fields that describe a thread's level and summary

A thread can carry two summaries. `extractiveSummary` comes from a summary pipeline and `aiSummary` from a model, and `summary` is a deprecated alias. Each block has its own `extractiveSummary`. `difficulty` gives the thread's level. Typed links such as `summarizes`, `extends` and `refines` join separate threads, and `teaches` and `requires` name skills. These fields help a reader pick threads. None of them marks a passage inside a thread to hide.

## Proposed fields

The proposal adds an optional `overview` string to the thread, written by the author to introduce the whole thread, and an optional `depth` on each block with three values.

- `core` marks the essential explanation, shown first.
- `detail` marks a derivation, a worked example or further explanation, opened on request.
- `refresher` marks a reminder of a prerequisite, opened when a learner needs it.

An app could show the overview and the core blocks first, with a Full explanation control that opens every block in source order. A learner new to the subject could open the full explanation from the start. The author sets `depth`, and it is separate from `difficulty`.

## Depths marked in the Scale and distance lesson

The fragment below marks three passages of [the Scale and distance lesson](https://github.com/framerslab/openquarry/blob/master/examples/reading-a-map/weaves/reading-a-map/the-map/scale-and-distance.md) with the proposed keys. Its line numbers count from the first line of the file, frontmatter included, and a publisher updates them whenever the lesson changes. The excerpt shows the proposed `overview` and `depth` keys beside the existing block ids, types and lines.

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

The core block says what 1:25,000 means. The detail block works through centimeters and meters. The refresher reminds the learner that a bigger second number means a smaller drawing.

## Rules for older content, and questions to settle first

A block without `depth` counts as core, so older content stays fully visible. An app that does not read `depth` shows the full Markdown. A warning or a premise the lesson depends on never sits only in a detail block. Headings stay with their content, and every block keeps its place in the document order and stays reachable by keyboard, search and print.

The thread schema accepts keys it does not name on a thread and its blocks. An otherwise valid thread may carry `depth`, and that does not make `depth` part of the format. Settle four questions first:

- how a block keeps its identity and its line range;
- whether `overview` is plain text;
- how overlapping ranges behave;
- how an author's marks survive reindexing.

The change starts in the source schemas in framerslab/codex and is synced into this repository. The types and tests follow, and apps add support last. Neither the example course nor the schemas use any of these fields.
