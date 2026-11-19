// openquarry new: writes one note or lesson, a Markdown file with the five keys every thread needs. It writes no
// licence: a person's notes and lessons carry the licence they state themselves.
import { randomUUID } from 'node:crypto'
import { closeSync, existsSync, openSync, rmSync, statSync, writeFileSync } from 'node:fs'
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
  // The weaves/ folder the check starts from. The top of a project holds fabric.yaml or catalogue.yaml beside weaves/,
  // the two files the check reads there, and the innermost such weaves/ counts. With neither file in the path, the first
  // weaves/ counts, so the note lands where a check from any folder above it reads it. So in
  // weaves/notes/.drafts/weaves/unit, the project's own weaves/ counts, and .drafts, which its check skips, is refused.
  const found = segments.flatMap((segment, index) => (segment === 'weaves' ? [index] : []))
  const top = (index) => segments.slice(0, index).join(sep) || sep
  const project = found.filter((index) => index < segments.length - 1 && ['fabric.yaml', 'catalogue.yaml'].some((file) => existsSync(join(top(index), file))))
  const weaves = project.length > 0 ? project[project.length - 1] : found.length > 0 ? found[0] : -1
  if (weaves === -1 || weaves === segments.length - 1) {
    throw new Refusal(`${name} is not inside a weaves/ folder, where openquarry check looks for notes and lessons: name a folder with --in, such as --in weaves/notes/getting-started`)
  }
  const typedSegments = here ? [] : typed.split(/[/\\]+/)
  // The link, as the person typed it when the typed path reaches that far; its full path otherwise.
  const linkShown = (index) => {
    const below = segments.length - 1 - index
    return typedSegments.length > below ? typedSegments.slice(0, typedSegments.length - below).join('/') : segments.slice(0, index + 1).join('/')
  }
  // weaves/ itself is a real folder: a link there would take the note out of the project.
  if (entry(segments.slice(0, weaves + 1).join(sep))?.isSymbolicLink()) {
    throw new Refusal(`${linkShown(weaves)} is a link: openquarry new writes only into real folders of the project, so nothing lands outside it`)
  }
  for (let index = weaves + 1; index < segments.length; index += 1) {
    const segment = segments[index]
    if (segment.startsWith('.') || segment === 'node_modules') {
      throw new Refusal(`${name} is in a folder openquarry check skips (${segment}): nothing written`)
    }
    if (entry(segments.slice(0, index + 1).join(sep))?.isSymbolicLink()) {
      throw new Refusal(`${linkShown(index)} is a link, and openquarry check follows no link below weaves/: nothing written`)
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
  const path = join(dir, `${slug}.md`)
  let fd
  try {
    // wx: create the file or fail. A file that is there is never opened.
    fd = openSync(path, 'wx')
  } catch (error) {
    if (error.code === 'EEXIST') throw new Refusal(`${shown} is already there: nothing written. Pass --slug for another file name.`)
    throw error
  }
  try {
    writeFileSync(fd, text)
    closeSync(fd)
  } catch (error) {
    // A write that began and failed (a full disk) leaves no half-written file, so the same command works again: this
    // run created the file, so it removes it.
    try {
      closeSync(fd)
    } catch {
      // Already closed.
    }
    rmSync(path, { force: true })
    throw new Refusal(`${shown} could not be written: ${String(error.message).split('\n')[0]}. Nothing was left in its place.`)
  }
  return [`wrote ${shown}`]
}
