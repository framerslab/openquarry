// Checks every OpenQuarry file in this folder with @framers/openquarry: fabric.yaml and catalogue.yaml at the top, and
// under weaves/ each weave.yaml, each loom.yaml and the frontmatter of each Markdown file. No two threads may share an
// id. It prints one line for each file and exits with 1 when any file is invalid.
//   npm run check
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import {
  validateCatalogue,
  validateFabricManifest,
  validateLoom,
  validateThreadFrontmatter,
  validateWeave,
} from '@framers/openquarry'

const root = fileURLToPath(new URL('.', import.meta.url))
const shown = (path) => relative(root, path).split(sep).join('/')

// Every file under a folder, in name order. Folders whose names start with a dot, and node_modules, are skipped.
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith('.') && entry.name !== 'node_modules')
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .flatMap((entry) => (entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)]))
}

// The YAML between the two --- lines at the top of a Markdown file.
const frontmatter = (text) => /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)?.[1]

const files = []
for (const [name, validate] of [['fabric.yaml', validateFabricManifest], ['catalogue.yaml', validateCatalogue]]) {
  if (existsSync(join(root, name))) files.push({ path: join(root, name), validate })
}
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
for (const { path, validate, thread } of files) {
  let errors
  try {
    const text = readFileSync(path, 'utf8').replace(/^﻿/, '')
    const yaml = thread ? frontmatter(text) : text
    if (yaml === undefined) errors = ['/ has no YAML frontmatter between two --- lines at the top']
    else {
      const value = parse(yaml)
      errors = validate(value).errors
      if (thread && errors.length === 0) {
        const other = ids.get(value.id)
        if (other) errors = [`/id is already the id of ${shown(other)}: give this file its own id`]
        else ids.set(value.id, path)
      }
    }
  } catch (error) {
    errors = [`/ cannot be read as YAML: ${String(error.message).split('\n')[0]}`]
  }
  if (errors.length === 0) console.log(`ok ${shown(path)}`)
  else {
    invalid += 1
    console.log(`not ok ${shown(path)}`)
    for (const error of errors) console.log(`  ${error}`)
  }
}

if (files.length === 0) {
  console.log('No OpenQuarry files found: expected fabric.yaml or a weaves/ folder here.')
  process.exitCode = 1
} else if (invalid > 0) {
  console.log(`${invalid} of ${files.length} files invalid.`)
  process.exitCode = 1
} else console.log(`${files.length} files checked, all valid.`)
