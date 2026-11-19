// Path rules for the files `init` copies out of a bundled template. A template is data: every path it holds is checked
// before anything is written, so no file can land outside the folder a person named.
import { lstatSync, readdirSync } from 'node:fs'
import { isAbsolute, join, relative, sep } from 'node:path'
import { Refusal } from './errors.mjs'

/** What is at a path, without following a link; undefined when nothing is there. */
export function entry(path) {
  try {
    return lstatSync(path)
  } catch (error) {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return undefined
    throw error
  }
}

// npm never packs a nested .gitignore, so the bundled copy of a starter stores a name that starts with a dot as _dot_
// plus the rest. The name is turned back here, BEFORE it is checked.
const decoded = (name) => (name.startsWith('_dot_') ? `.${name.slice(5)}` : name)

/**
 * Every file of a template folder: where it is in the package, and the path it is written to, as checked segments.
 * Refuses a template that holds anything but plain files and folders, a path that would leave the target once decoded
 * (`.`, `..`, a separator, a drive), and any path into `.git`.
 */
export function templateFiles(dir, name) {
  const files = []
  const walk = (at, above) => {
    for (const stored of readdirSync(at)) {
      const from = join(at, stored)
      const segments = [...above, decoded(stored)]
      const shown = segments.join('/')
      const segment = segments[segments.length - 1]
      if (segment === '' || segment === '.' || segment === '..' || /[/\\\0:]/.test(segment)) {
        throw new Refusal(`the ${name} template holds ${shown}, a path that leaves the folder: nothing written`)
      }
      const info = lstatSync(from)
      if (info.isDirectory()) walk(from, segments)
      else if (info.isFile()) files.push({ from, segments, shown })
      else throw new Refusal(`the ${name} template holds ${shown}, which is not a plain file or a folder: nothing written`)
    }
  }
  walk(dir, [])
  for (const file of files) {
    if (file.segments.some((segment) => segment.toLowerCase() === '.git')) {
      throw new Refusal(`the ${name} template holds ${file.shown}, and a template never writes into .git: nothing written`)
    }
  }
  // One order everywhere: by the path a person sees.
  return files.sort((a, b) => (a.shown < b.shown ? -1 : a.shown > b.shown ? 1 : 0))
}

/** True when `path` lies beneath `base`, whatever the two hold. */
export function beneath(base, path) {
  const rel = relative(base, path)
  return rel !== '' && !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`)
}
