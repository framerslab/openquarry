// openquarry init: copies a bundled template into a folder, byte for byte. It copies files and nothing else: no code
// from a template is run, nothing is installed, and no file that is already there is ever overwritten.
import { closeSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Refusal, UsageError } from './errors.mjs'
import { beneath, entry, templateFiles } from './paths.mjs'

const bundled = fileURLToPath(new URL('../templates/', import.meta.url))

/** The names of the bundled templates: `notes`, the default, first; the rest in name order. */
export function templateNames(dir = bundled) {
  let names = []
  try {
    names = readdirSync(dir).filter((name) => /^[a-z0-9][a-z0-9-]*$/.test(name) && lstatSync(join(dir, name)).isDirectory())
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
  }
  return names.sort((a, b) => (a === 'notes' ? -1 : b === 'notes' ? 1 : a < b ? -1 : a > b ? 1 : 0))
}

// A folder's name as a shell takes it: quoted when it holds anything but letters, digits and . _ / -, and after ./ when
// it starts with a hyphen, so `cd` never reads it as an option (`cd -` is the previous folder).
const shell = (text) => {
  const path = text.startsWith('-') ? `./${text}` : text
  return /^[A-Za-z0-9._/-]+$/.test(path) ? path : `'${path.replaceAll("'", "'\\''")}'`
}

/**
 * Copies the template into the folder and returns the lines to print.
 * `folder` is the folder as the person typed it (undefined: the current folder), `cwd` where they typed it.
 */
export function init({ folder, template = 'notes', force = false, cwd = process.cwd(), templates = bundled }) {
  const names = templateNames(templates)
  if (names.length === 0) throw new Refusal('this copy of openquarry holds no templates: install the package from npm')
  if (!names.includes(template)) throw new UsageError(`no template named ${JSON.stringify(template)}: the templates are ${names.join(', ')}`)
  // Read and check the whole template before the target is touched.
  const files = templateFiles(join(templates, template), template)

  const typed = folder === undefined ? '' : folder.replace(/[/\\]+$/, '') || folder
  const here = typed === '' || typed === '.'
  const name = here ? 'this folder' : typed
  const show = (path) => (here ? path : `${typed}/${path}`)
  let target = resolve(cwd, folder ?? '.')

  // The target: a folder (a link to one is the person's own and is followed), or nothing yet.
  let info = entry(target)
  if (info?.isSymbolicLink()) {
    try {
      info = statSync(target)
    } catch {
      throw new Refusal(`${name} is a link that leads nowhere: nothing written`)
    }
  }
  if (info && !info.isDirectory()) throw new Refusal(`${name} is a file, not a folder: nothing written`)
  if (info) {
    target = realpathSync(target)
    const holds = readdirSync(target).filter((item) => item !== '.git')
    if (holds.length > 0 && !force) {
      throw new Refusal(`${name} is not empty: nothing written. Pass --force to add the files that are missing; no file is ever overwritten.`)
    }
  }

  // Beneath the target, every folder on the way to a file is a real folder or is missing. A link or a file in that
  // place stops the command here, before the first write, so nothing is written through a link that leaves the target.
  // This holds for the folders as they stand at this check. A folder that another process swaps for a link between the
  // check and a write is not defended: Node opens files by path and has no call that opens one relative to a folder
  // already checked. The target is the person's own folder on their own machine.
  const plan = files.map((file) => {
    const dest = join(target, ...file.segments)
    if (!beneath(target, dest)) throw new Refusal(`the ${template} template holds ${file.shown}, a path that leaves the folder: nothing written`)
    if (info) {
      let at = target
      for (const [index, segment] of file.segments.slice(0, -1).entries()) {
        at = join(at, segment)
        const found = entry(at)
        if (!found) break
        const shown = show(file.segments.slice(0, index + 1).join('/'))
        if (found.isSymbolicLink()) throw new Refusal(`${shown} is a link, not a folder: nothing written, so no file lands outside ${name}`)
        if (!found.isDirectory()) throw new Refusal(`${shown} is a file, not a folder: nothing written`)
      }
    }
    return { ...file, dest, kept: Boolean(info && entry(dest)) }
  })

  const lines = []
  let written = 0
  for (const file of plan) {
    if (file.kept) {
      lines.push(`kept ${show(file.shown)} (already there)`)
      continue
    }
    let fd
    try {
      // The template file is read before the destination is opened, so a failed read touches nothing in the target.
      const data = readFileSync(file.from)
      mkdirSync(dirname(file.dest), { recursive: true })
      // wx: create the file or fail. It never opens a file that is there and never writes through a link at that name.
      fd = openSync(file.dest, 'wx')
      writeFileSync(fd, data)
      closeSync(fd)
      fd = undefined
    } catch (error) {
      // Only a file this run created is removed: a write that began and failed (a full disk) leaves no half-written
      // file, and a path this run never opened, which another process may have made, is never touched.
      if (fd !== undefined) {
        try {
          closeSync(fd)
        } catch {
          // Already closed.
        }
        try {
          rmSync(file.dest, { force: true })
        } catch {
          // Nothing more can be done; the error line below names the file.
        }
      }
      const reason = error.code === 'EEXIST' ? 'it appeared while the files were being written' : String(error.message).split('\n')[0]
      throw new Refusal(`${show(file.shown)} could not be written: ${reason}. ${written} of ${plan.length} files were written before it and are left in place; run the command again with --force to add the rest.`)
    }
    written += 1
    lines.push(`wrote ${show(file.shown)}`)
  }

  const kept = plan.length - written
  lines.push(`Started ${name} from the ${template} template: ${kept ? `${written} files written, ${kept} kept.` : `${written} files.`}`)
  lines.push('Next:')
  if (!here) lines.push(`  cd ${shell(typed)}`)
  lines.push('  npx openquarry check')
  return lines
}
