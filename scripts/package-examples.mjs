// The examples on the package page (openquarry.dev/package/) and the short one on the landing. Each is a whole file a
// reader can save and run. CI runs every one against the package and compares what it prints with `output`, the text
// the page shows under it (scripts/check-package-examples.mjs).

export const installs = [
  ['npm', 'npm install openquarry'],
  ['pnpm', 'pnpm add openquarry'],
  ['yarn', 'yarn add openquarry'],
]

export const quickExample = {
  file: 'check.mjs',
  lang: 'js',
  code: `import { validateWeave } from 'openquarry'

const result = validateWeave({
  slug: 'reading-a-map',
  title: 'Reading a map',
  kind: 'course',
})
console.log(result)
// { valid: true, errors: [] }`,
  output: '{ valid: true, errors: [] }',
}

export const packageExamples = [
  {
    id: 'frontmatter',
    title: "Check a note's or a lesson's frontmatter",
    text: '<p>Parse the YAML between the two <code>---</code> lines, then pass it to <code>validateThreadFrontmatter</code>. This lesson leaves out <code>version</code>, so the result names it.</p>',
    file: 'lesson.mjs',
    lang: 'js',
    code: `import { parse } from 'yaml'
import { validateThreadFrontmatter } from 'openquarry'

const frontmatter = parse(\`
id: 70c967bf-2dba-4399-aef1-671174eb904f
slug: scale-and-distance
title: Scale and distance
contentType: lesson
\`)

const result = validateThreadFrontmatter(frontmatter)
console.log(result.valid)
for (const error of result.errors) console.log(error)`,
    output: `false
/ must have required property 'version'`,
  },
  {
    id: 'folders',
    title: 'Check fabric.yaml, weave.yaml and loom.yaml',
    text: '<p>A fabric can have a <code>fabric.yaml</code>, a weave has a <code>weave.yaml</code> and a loom a <code>loom.yaml</code>, and each file has its own validator. A <code>kind</code> is one lowercase word, so <code>Course</code> fails.</p>',
    file: 'folders.mjs',
    lang: 'js',
    code: `import { validateFabricManifest, validateLoom, validateWeave } from 'openquarry'

console.log(validateFabricManifest({ format: 'openquarry', version: 2 }).valid)
console.log(validateLoom({ slug: 'the-map', title: 'The map', kind: 'unit' }).valid)

const weave = validateWeave({ slug: 'reading-a-map', title: 'Reading a map', kind: 'Course' })
for (const error of weave.errors) console.log(error)`,
    output: `true
true
/kind must match pattern "^[a-z][a-z0-9-]*$"`,
  },
  {
    id: 'catalogue',
    title: 'Check a catalogue',
    text: "<p><code>validateCatalogue</code> checks a <code>catalogue.yaml</code> against its schema, then four rules a schema cannot hold. Each id is listed once, every link names something the catalogue lists, an entry's <code>home</code> is one of its subjects, and no chain of links makes a circle.</p>",
    file: 'catalogue.mjs',
    lang: 'js',
    code: `import { validateCatalogue } from 'openquarry'

const result = validateCatalogue({
  id: 'field-skills',
  title: 'Field skills',
  subjects: [{ id: 'navigation', title: 'Navigation', broader: [] }],
  entries: [
    {
      slug: 'reading-a-map',
      home: 'outdoors',
      subjects: ['navigation'],
      requires: ['compass-basics'],
    },
  ],
})
for (const error of result.errors) console.log(error)`,
    output: `/entries/0/home must be one of the entry's subjects: "navigation"
/entries/0/requires/0 names an entry the catalogue does not list: "compass-basics"`,
  },
  {
    id: 'blocks-index',
    title: 'Check a saved blocks index',
    text: '<p>A blocks index lists tagged blocks in <code>threads</code> and uses <code>threadPath</code> in tag references. Save this script as <code>blocks.mjs</code> and run <code>node blocks.mjs blocks-index.json</code> on a generated index. <a href="/format/#version-1-fabrics">Version 1 compatibility</a> explains the older field names.</p>',
    file: 'blocks.mjs',
    fixture: 'test/fixtures/blocks-index-v1.json',
    lang: 'js',
    code: `import { readFileSync } from 'node:fs'
import { validateBlocksIndex } from 'openquarry'

const index = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const result = validateBlocksIndex(index)
console.log(result.valid)`,
    output: 'true',
  },
  {
    id: 'json-schema',
    title: 'Use the JSON Schemas in your own validator',
    text: '<p>Each schema is exported as an object, JSON Schema draft 2020-12. Compile it with Ajv\'s 2020 build and <code>ajv-formats</code> (<code>npm install ajv ajv-formats</code>), or with any validator that reads draft 2020-12.</p>',
    file: 'schema.mjs',
    lang: 'js',
    code: `import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import { loomSchema } from 'openquarry'

const ajv = new Ajv2020({ allErrors: true, strict: false })
addFormats(ajv)
const validate = ajv.compile(loomSchema)

console.log(validate({ slug: 'the-map', title: 'The map', kind: 'unit' }))
console.log(validate({ slug: 'the-map' }))
console.log(validate.errors[0].message)`,
    output: `true
false
must have required property 'title'`,
  },
  {
    id: 'types',
    title: 'Catch a wrong value with the TypeScript types',
    text: "<p>The types describe every file the schemas check. A value the format does not allow, such as <code>contentType: 'lecture'</code>, fails type checking before the code runs.</p>",
    file: 'lesson.ts',
    lang: 'ts',
    code: `import { validateThreadFrontmatter, type ThreadFrontmatter } from 'openquarry'

const lesson: ThreadFrontmatter = {
  id: '70c967bf-2dba-4399-aef1-671174eb904f',
  slug: 'scale-and-distance',
  title: 'Scale and distance',
  version: '1.0.0',
  contentType: 'lesson',
  difficulty: 'beginner',
  teaches: ['field-skills/skill/map-scale'],
}

console.log(validateThreadFrontmatter(lesson).valid)`,
    output: 'true',
    // CI also compiles the example with this value in place of 'lesson' and expects a type error that names it.
    typeError: ["contentType: 'lesson'", "contentType: 'lecture'"],
  },
  {
    id: 'commonjs',
    title: 'Load the package from CommonJS',
    text: '<p>The package ships an ES module build and a CommonJS build, so <code>require</code> works too.</p>',
    file: 'check.cjs',
    lang: 'js',
    code: `const { validateLoom } = require('openquarry')

console.log(validateLoom({ slug: 'the-map', title: 'The map', kind: 'unit' }))`,
    output: '{ valid: true, errors: [] }',
  },
  {
    id: 'yaml-sources',
    title: 'Read the YAML sources',
    text: '<p>The package ships each schema\'s YAML source, byte for byte, under <code>@framers/openquarry/schema/</code>. These files come from <code>@framers/openquarry</code>, so install it to import them.</p>',
    file: 'sources.mjs',
    lang: 'js',
    code: `import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { parse } from 'yaml'

const require = createRequire(import.meta.url)
const file = require.resolve('@framers/openquarry/schema/weave.schema.yaml')
console.log(parse(readFileSync(file, 'utf8')).title)`,
    output: 'Weave',
  },
]
