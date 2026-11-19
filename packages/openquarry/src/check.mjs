// openquarry check: validates every OpenQuarry file in a folder with @framers/openquarry. fabric.yaml and catalogue.yaml
// at the top, and under weaves/ each weave.yaml, each loom.yaml and the frontmatter of each Markdown file. No two
// threads may share an id. One line for each file; the result says whether any file is invalid.
// The rules and the lines are those of the check.mjs script the starters carry, so a project reads the same either way.
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { validateCatalogue, validateFabricManifest, validateLoom, validateThreadFrontmatter, validateWeave } from '@framers/openquarry'
import { Refusal } from './errors.mjs'
import { block, parse, unmarked } from './frontmatter.mjs'

// Every file under a folder, in name order. Folders whose names start with a dot, and node_modules, are skipped. A link
// to a folder is not followed: it is listed as an entry, like a file.
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true })
    .filter((item) => !item.isDirectory() || (!item.name.startsWith('.') && item.name !== 'node_modules'))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .flatMap((item) => (item.isDirectory() ? walk(join(dir, item.name)) : [join(dir, item.name)]))
}

/**
 * Checks the folder and returns the lines of the report and whether every file is valid.
 * `folder` is the folder as the person typed it (undefined: the current folder), `cwd` where they typed it.
 */
export function check({ folder, cwd = process.cwd() } = {}) {
  const root = resolve(cwd, folder ?? '.')
  let isFolder = false
  try {
    isFolder = statSync(root).isDirectory()
  } catch {
    // Nothing is there.
  }
  if (!isFolder) throw new Refusal(`${folder ?? 'this folder'} is not a folder`)
  const shown = (path) => relative(root, path).split(sep).join('/')

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

  const lines = []
  const ids = new Map()
  let invalid = 0
  for (const { path, validate, thread } of files) {
    let errors
    try {
      // A pipe, a socket, a device or a link to a folder that is named like a file of the format is never opened.
      if (!statSync(path).isFile()) errors = ['/ is not a plain file']
      else {
        const text = unmarked(readFileSync(path, 'utf8'))
        const yaml = thread ? block(text) : text
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
      }
    } catch (error) {
      errors = [`/ cannot be read as YAML: ${String(error.message).split('\n')[0]}`]
    }
    if (errors.length === 0) lines.push(`ok ${shown(path)}`)
    else {
      invalid += 1
      lines.push(`not ok ${shown(path)}`)
      for (const error of errors) lines.push(`  ${error}`)
    }
  }

  if (files.length === 0) lines.push('No OpenQuarry files found: expected fabric.yaml or a weaves/ folder here.')
  else if (invalid > 0) lines.push(`${invalid} of ${files.length} files invalid.`)
  else lines.push(`${files.length} files checked, all valid.`)
  return { lines, valid: files.length > 0 && invalid === 0 }
}
