# Website design

The selected design is `landing-board.png`: a single board with desktop (1440) and mobile (390) compositions in light and dark. The implemented site uses a nested folder diagram paired with the actual map-reading lesson. The headline is “Notes and courses, in plain files.”

Newsreader and Inter are self-hosted with their SIL Open Font Licences in `site/fonts/`. Warm paper and dark ink share one green accent. Body text is 18 px; navigation and code are at least 14 px. Navigation stays in one horizontally scrollable row on small screens. Themes follow the system until the reader chooses one. Reduced-motion preferences disable the entrance animation.

The course and language-model guides start with short summaries before the complete explanations. Reading depths and spiral progression are proposals, explicitly separate from supported schema features. No schema or package API changes are required for the site.

CI builds the static pages, checks the existing schema bytes, runs browser checks at 320, 390 and 1440 pixels in both themes, and retains screenshots as an artifact. `scripts/build-site.mjs` removes only the old root-to-repository and schema-page-to-index redirects; versioned schema redirects and host alias middleware remain.
