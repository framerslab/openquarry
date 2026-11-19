// openquarry new: writes one note or lesson, a Markdown file with the five keys every thread needs. It writes no
// licence: a person's notes and lessons carry the licence they state themselves.
import { randomUUID } from 'node:crypto'
import { existsSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { stringify } from 'yaml'
import { validateThreadFrontmatter } from '@framers/openquarry'
import { Refusal, UsageError } from './errors.mjs'
import { block, parse } from './frontmatter.mjs'
import { entry } from './paths.mjs'

const contentTypes = { note: 'markdown', lesson: 'lesson' }
const example = 'openquarry new note "A title"'

/** A title as a slug: its letters without their accents, in lowercase, with a hyphen for each run of anything else. */
export function slugOf(title) {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Writes the file and returns the lines to print. `folder` is the folder as the person typed it (undefined: the current
 * folder), `cwd` where they typed it.
 */
export function newThread({ kind, title: given, folder, slug: wanted, cwd = process.cwd() }) {
  if (kind === undefined) throw new UsageError(`say note or lesson: ${example}`)
  if (!Object.hasOwn(contentTypes, kind)) throw new UsageError(`say note or lesson, not ${JSON.stringify(kind)}`)
  const title = (given ?? '').trim()
  if (title === '') throw new UsageError(`a title is missing: ${example}`)
  if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(title)) throw new UsageError('the title must be one line with no control character')
  if (wanted !== undefined && !(/^[a-z0-9-]+$/.test(wanted) && /[a-z0-9]/.test(wanted))) {
    throw new UsageError(`--slug takes lowercase letters, digits and hyphens, with a letter or a digit: got ${JSON.stringify(wanted)}`)
  }
  const slug = wanted ?? slugOf(title)
  if (slug === '') throw new UsageError(`no slug can be made from the title ${JSON.stringify(title)}: pass --slug with lowercase letters, digits and hyphens`)

  const typed = folder === undefined ? '' : folder.replace(/[/\\]+$/, '') || folder
  const here = typed === '' || typed === '.'
  const name = here ? 'this folder' : typed
  const dir = resolve(cwd, folder ?? '.')
  let info
  try {
    info = statSync(dir)
  } catch {
    throw new Refusal(`${name} is not a folder: make it first`)
  }
  if (!info.isDirectory()) throw new Refusal(`${name} is a file, not a folder`)

  // The folder is one the check walks: below a weaves/ folder, through real folders only (the check follows no link
  // there, and a link can lead out of the project), none of them a dot folder or node_modules.
  const segments = dir.split(sep)
  // The weaves/ folder the check starts from: the innermost one beside a fabric.yaml (the top of a project), or the last
  // one in the path when no fabric.yaml is found. So in weaves/notes/.drafts/weaves/unit of a project, the project's own
  // weaves/ counts, and .drafts, which its check skips, is refused.
  const found = segments.flatMap((segment, index) => (segment === 'weaves' ? [index] : []))
  const project = found.filter((index) => index < segments.length - 1 && existsSync(join(segments.slice(0, index).join(sep) || sep, 'fabric.yaml')))
  const weaves = project.length > 0 ? project[project.length - 1] : found.length > 0 ? found[found.length - 1] : -1
  if (weaves === -1 || weaves === segments.length - 1) {
    throw new Refusal(`${name} is not inside a weaves/ folder, where openquarry check looks for notes and lessons: name a folder with --in, such as --in weaves/notes/getting-started`)
  }
  const typedSegments = here ? [] : typed.split(/[/\\]+/)
  for (let index = weaves + 1; index < segments.length; index += 1) {
    const segment = segments[index]
    if (segment.startsWith('.') || segment === 'node_modules') {
      throw new Refusal(`${name} is in a folder openquarry check skips (${segment}): nothing written`)
    }
    if (entry(segments.slice(0, index + 1).join(sep))?.isSymbolicLink()) {
      // The link, as the person typed it when the typed path reaches that far; its full path otherwise.
      const below = segments.length - 1 - index
      const shown = typedSegments.length > below ? typedSegments.slice(0, typedSegments.length - below).join('/') : segments.slice(0, index + 1).join('/')
      throw new Refusal(`${shown} is a link, and openquarry check follows no link below weaves/: nothing written`)
    }
  }

  // Five keys, every value a string. The YAML writer quotes what YAML would read as something else (a title such as
  // "true", "2026", "a: b" or "Title # draft") and never folds a long title onto a second line.
  const data = { id: randomUUID(), slug, title, version: '1.0.0', contentType: contentTypes[kind] }
  const text = `---\n${stringify(data, { lineWidth: 0 })}---\n\n# ${title}\n`
  // Read the text back the way the check will, before it is written: the same five keys, the same values, and valid.
  const yaml = block(text)
  const read = yaml === undefined ? undefined : parse(yaml)
  const same = read && typeof read === 'object' && Object.keys(read).join() === Object.keys(data).join() && Object.keys(data).every((key) => read[key] === data[key])
  if (!same || !validateThreadFrontmatter(read).valid) throw new Refusal(`the title ${JSON.stringify(title)} cannot be written as YAML that reads back the same: nothing written`)

  const shown = here ? `${slug}.md` : `${typed}/${slug}.md`
  try {
    // wx: create the file or fail. A file that is there is never opened.
    writeFileSync(join(dir, `${slug}.md`), text, { flag: 'wx' })
  } catch (error) {
    if (error.code === 'EEXIST') throw new Refusal(`${shown} is already there: nothing written. Pass --slug for another file name.`)
    throw error
  }
  return [`wrote ${shown}`]
}
