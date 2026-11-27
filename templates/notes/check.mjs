// Checks fabric.yaml, catalogue.yaml and blocks-index.json at the top, and under weaves/ each weave.yaml, each
// loom.yaml and the frontmatter of each Markdown file. It reports each file and exits with 1 when any file is invalid.
//   npm run check
import { existsSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import {
  validateBlocksIndex,
  validateCatalogue,
  validateFabricManifest,
  validateLoom,
  validateThreadFrontmatter,
  validateWeave,
} from '@framers/openquarry'
import { checkThreadFields, readPlain } from './check-input.mjs'

const root = fileURLToPath(new URL('.', import.meta.url))
const shown = (path) => relative(root, path).split(sep).join('/')
const legacyThreadPath = /^weaves\/[^/]+\/(?:[^/]+\/)*(?:looms|strands)\//

// Every file under a folder, in name order. Folders whose names start with a dot, and node_modules, are skipped.
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.isDirectory() || (!entry.name.startsWith('.') && entry.name !== 'node_modules'))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]))
}

// The YAML between the two --- lines at the top of a Markdown file.
const frontmatter = (text) => /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)?.[1]

const files = []
const rootEntries = new Set(readdirSync(root))
for (const [name, validate] of [
  ['fabric.yaml', validateFabricManifest], ['catalogue.yaml', validateCatalogue], ['blocks-index.json', validateBlocksIndex],
]) {
  if (rootEntries.has(name)) files.push({ path: join(root, name), validate, json: name.endsWith('.json') })
}
let fabricVersion = files.some(({ validate }) => validate === validateFabricManifest) ? undefined : 1
if (existsSync(join(root, 'weaves'))) {
  for (const path of walk(join(root, 'weaves'))) {
    const name = path.split(sep).pop()
    if (name === 'weave.yaml') files.push({ path, validate: validateWeave })
    else if (name === 'loom.yaml') files.push({ path, validate: validateLoom })
    else if (name.endsWith('.md')) files.push({ path, validate: validateThreadFrontmatter, thread: true })
  }
}

const ids = new Map()
let invalid = 0
for (const { path, validate, thread, json } of files) {
  let errors
  let warnings
  try {
    const text = readPlain(path)
    const content = text === undefined || !thread ? text : frontmatter(text)
    if (text === undefined) errors = ['/ is not a plain file']
    else if (content === undefined) errors = ['/ has no YAML frontmatter between two --- lines at the top']
    else {
      const value = json ? JSON.parse(content) : parse(content)
      const result = json || validate === validateFabricManifest
        ? checkThreadFields(value, validate)
        : validate(value)
      errors = result.errors
      warnings = result.warnings
      if (validate === validateFabricManifest && errors.length === 0) fabricVersion = value.version
      if (thread && errors.length === 0) {
        const other = ids.get(value.id)
        if (other) errors = [`/id is already the id of ${shown(other)}: give this file its own id`]
        else ids.set(value.id, path)
      }
    }
  } catch (error) {
    errors = [`/ cannot be read as ${json ? 'JSON' : 'YAML'}: ${String(error.message).split('\n')[0]}`]
  }
  const relativePath = shown(path)
  if (errors.length === 0) {
    console.log(`ok ${relativePath}`)
    for (const warning of warnings ?? []) console.log(`  warning: ${warning}`)
    if (thread && fabricVersion !== undefined && legacyThreadPath.test(relativePath)) {
      const warning = fabricVersion === 2
        ? 'Version 1 folder names in a version 2 fabric. Move the thread to weaves/<weave>/<loom>/<thread>.md.'
        : 'Version 1 thread layout. Use version 2 for new fabrics.'
      console.log(`  warning: ${warning}`)
    }
  } else {
    invalid += 1
    console.log(`not ok ${relativePath}`)
    for (const error of errors) console.log(`  ${error}`)
  }
}

if (files.length === 0) {
  console.log('No OpenQuarry files found: expected fabric.yaml, blocks-index.json or a weaves/ folder here.')
  process.exitCode = 1
} else if (invalid > 0) {
  console.log(`${invalid} of ${files.length} files invalid.`)
  process.exitCode = 1
} else console.log(`${files.length} files checked, all valid.`)
