// openquarry check: validates fabric.yaml, catalogue.yaml and blocks-index.json at the top, and under weaves/
// each weave.yaml, each loom.yaml and the frontmatter of each Markdown file. No two threads may share an id.
// For a starter project the report matches the check.mjs script it carries.
import { readdirSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { validateBlocksIndex, validateCatalogue, validateFabricManifest, validateLoom, validateThreadFrontmatter, validateWeave } from '@framers/openquarry'
import { checkThreadFields, readPlain } from './check-input.mjs'
import { Refusal } from './errors.mjs'
import { block, parse } from './frontmatter.mjs'
import { entry } from './paths.mjs'

// A link can lead nowhere, pass through a file or go round in a loop.
const leadsNowhere = (error) => error.code === 'ENOENT' || error.code === 'ENOTDIR' || error.code === 'ELOOP'
const legacyThreadPath = /^weaves\/[^/]+\/(?:[^/]+\/)*(?:looms|strands)\//

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

  // A name is there when anything is at it, a link that leads nowhere included: such a link is reported, never skipped
  // as if the file were missing.
  const files = []
  for (const [name, validate] of [
    ['fabric.yaml', validateFabricManifest], ['catalogue.yaml', validateCatalogue], ['blocks-index.json', validateBlocksIndex],
  ]) {
    if (entry(join(root, name))) files.push({ path: join(root, name), validate, json: name.endsWith('.json') })
  }
  let fabricVersion = files.some(({ validate }) => validate === validateFabricManifest) ? undefined : 1
  if (entry(join(root, 'weaves'))) {
    // weaves/ is a folder, or a link to one, which the walk starts by reading.
    let isWeavesFolder = false
    try {
      isWeavesFolder = statSync(join(root, 'weaves')).isDirectory()
    } catch (error) {
      // A link that leads nowhere, or round in a loop, is not a folder; any other answer is the file system's own.
      if (!leadsNowhere(error)) throw error
    }
    if (!isWeavesFolder) {
      const at = folder === undefined ? '' : `${folder.replace(/[/\\]+$/, '') || folder}/`
      throw new Refusal(`${at}weaves is not a folder: a project keeps its notes and lessons in a weaves/ folder`)
    }
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
  for (const { path, validate, thread, json } of files) {
    let errors
    let warnings
    try {
      // Opened once, without waiting on a pipe, and read from that same handle only when it is a plain file: a pipe, a
      // socket, a device or a folder named like a file of the format is reported and never read. A link to a plain file
      // is read, as the starters' check.mjs reads it.
      const text = readPlain(path)
      if (text === undefined) errors = ['/ is not a plain file']
      else {
        const content = thread ? block(text) : text
        if (content === undefined) errors = ['/ has no YAML frontmatter between two --- lines at the top']
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
      }
    } catch (error) {
      errors = [`/ cannot be read as ${json ? 'JSON' : 'YAML'}: ${String(error.message).split('\n')[0]}`]
    }
    const relativePath = shown(path)
    if (errors.length === 0) {
      lines.push(`ok ${relativePath}`)
      for (const warning of warnings ?? []) lines.push(`  warning: ${warning}`)
      if (thread && fabricVersion !== undefined && legacyThreadPath.test(relativePath)) {
        const warning = fabricVersion === 2
          ? 'Version 1 folder names in a version 2 fabric. Move the thread to weaves/<weave>/<loom>/<thread>.md.'
          : 'Version 1 thread layout. Use version 2 for new fabrics.'
        lines.push(`  warning: ${warning}`)
      }
    } else {
      invalid += 1
      lines.push(`not ok ${relativePath}`)
      for (const error of errors) lines.push(`  ${error}`)
    }
  }

  if (files.length === 0) lines.push('No OpenQuarry files found: expected fabric.yaml, blocks-index.json or a weaves/ folder here.')
  else if (invalid > 0) lines.push(`${invalid} of ${files.length} files invalid.`)
  else lines.push(`${files.length} files checked, all valid.`)
  return { lines, valid: files.length > 0 && invalid === 0 }
}
