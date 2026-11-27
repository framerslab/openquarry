// openquarry new: writes a thread or a course weave, and files the course in the project's catalogue if it has one.
import { randomUUID } from 'node:crypto'
import { chmodSync, closeSync, mkdirSync, openSync, renameSync, rmdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { isAlias, parseDocument, stringify, visit } from 'yaml'
import { validateCatalogue, validateThreadFrontmatter, validateWeave } from '@framers/openquarry'
import { readPlain } from './check-input.mjs'
import { Refusal, UsageError } from './errors.mjs'
import { block, parse } from './frontmatter.mjs'
import { entry } from './paths.mjs'

const contentTypes = { note: 'markdown', lesson: 'lesson' }

/** A title as a slug: its letters without their accents, in lowercase, with a hyphen for each run of anything else. */
export function slugOf(title) {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function titleAndSlug(given, wanted, example) {
  const title = (given ?? '').trim()
  if (title === '') throw new UsageError(`a title is missing: ${example}`)
  if (/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(title)) throw new UsageError('the title must be one line with no control character')
  if (wanted !== undefined && !(/^[a-z0-9-]+$/.test(wanted) && /[a-z0-9]/.test(wanted))) {
    throw new UsageError(`--slug takes lowercase letters, digits and hyphens, with a letter or a digit: got ${JSON.stringify(wanted)}`)
  }
  const slug = wanted ?? slugOf(title)
  if (slug === '') throw new UsageError(`no slug can be made from the title ${JSON.stringify(title)}: pass --slug with lowercase letters, digits and hyphens`)
  return { title, slug }
}

/**
 * Writes the file and returns the lines to print. `folder` is the folder as the person typed it (undefined: the current
 * folder), `cwd` where they typed it.
 */
export function newThread({ kind, title: given, folder, slug: wanted, cwd = process.cwd() }) {
  const example = 'openquarry new note "A title"'
  if (kind === undefined) throw new UsageError(`say note, lesson or course: ${example}`)
  if (!Object.hasOwn(contentTypes, kind)) throw new UsageError(`say note, lesson or course, not ${JSON.stringify(kind)}`)
  const { title, slug } = titleAndSlug(given, wanted, example)

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

  // The folder is one the check walks: below the project's weaves/ folder, through real folders only (the check follows
  // no link there, and a link can lead out of the project), none of them a dot folder or node_modules.
  const segments = dir.split(sep)
  // The folder made of the first `count` segments of the path.
  const top = (count) => segments.slice(0, count).join(sep) || sep
  // The top of the project is the innermost folder, the one named or one above it, that holds fabric.yaml or
  // catalogue.yaml as a file, the two files the check reads there; the check reads the weaves/ beside them. So a project
  // kept inside another folder named weaves counts from its own top: the top itself, its weaves/ itself and any other
  // weaves/ in it are refused, as are folders below weaves/notes/.drafts/weaves, since the check skips .drafts. A folder
  // that only bears one of those names is no manifest. With neither file in the path, the first weaves/ counts, so the
  // note lands where a check from any folder above it reads it.
  const manifest = (path) => {
    try {
      return statSync(path).isFile()
    } catch {
      return false
    }
  }
  let count = segments.length
  while (count > 0 && !['fabric.yaml', 'catalogue.yaml'].some((file) => manifest(join(top(count), file)))) count -= 1
  const weaves = count > 0 ? (segments[count] === 'weaves' ? count : -1) : segments.indexOf('weaves')
  if (weaves === -1 || weaves === segments.length - 1) {
    throw new Refusal(`${name} is not inside the project's weaves/ folder, where openquarry check looks for notes and lessons: name a folder with --in, such as --in weaves/notes/getting-started`)
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
  writeNew(join(dir, `${slug}.md`), shown, text)
  return [`wrote ${shown}`]
}

function writeNew(path, shown, text) {
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
}

function updateCatalogue(path, slug, subject) {
  const info = entry(path)
  const text = info?.isFile() ? readPlain(path) : undefined
  if (text === undefined) throw new Refusal('catalogue.yaml must be a regular file to add an entry')
  const doc = parseDocument(text)
  if (doc.errors.length) throw new Refusal(`catalogue.yaml: ${doc.errors[0].message}`)
  const value = doc.toJS()
  const result = validateCatalogue(value)
  if (!result.valid) throw new Refusal(`catalogue.yaml: ${result.errors[0]}. Run openquarry check for the full report.`)
  const ids = value.subjects.map(({ id }) => id)
  if (ids.length === 0) throw new Refusal('catalogue.yaml has no subjects: add one, then pass its id with --subject')
  if (!ids.includes(subject)) {
    const problem = subject === undefined ? 'pass --subject' : `unknown subject ${JSON.stringify(subject)}`
    throw new Refusal(`${problem}: catalogue.yaml lists ${ids.join(', ')}`)
  }
  if (value.entries.some((item) => item.slug === slug)) {
    throw new Refusal(`catalogue.yaml already lists ${JSON.stringify(slug)}: choose another slug or restore the listed weave`)
  }

  const added = { slug, home: subject, subjects: [subject], requires: [] }
  const entries = doc.get('entries', true)
  const withComments = (node, from) => Object.assign(node, {
    comment: from.comment, commentBefore: from.commentBefore, spaceBefore: from.spaceBefore,
  })
  if (isAlias(entries)) {
    // An empty sequence can be shared with a subject's broader links. Only entries should grow.
    doc.set('entries', withComments(doc.createNode([...value.entries, added]), entries))
  } else {
    if (entries.anchor) {
      visit(doc, { Alias: (_, alias) => {
        if (alias.resolve(doc) === entries) return withComments(doc.createNode([]), alias)
      } })
    }
    entries.add(doc.createNode(added))
  }
  const updated = doc.toString({ lineWidth: 0 })
  return { text, updated: text.includes('\r\n') ? updated.replaceAll('\n', '\r\n') : updated, mode: info.mode }
}

/** Creates a course in the current project's weaves/ and appends its catalogue entry, when there is a catalogue. */
export function newCourse({ title: given, slug: wanted, subject, cwd = process.cwd() }) {
  const { title, slug } = titleAndSlug(given, wanted, 'openquarry new course "A title"')
  const data = { slug, title, kind: 'course' }
  const result = validateWeave(data)
  if (!result.valid) throw new Refusal(`weave.yaml: ${result.errors.join('; ')}`)

  const root = resolve(cwd)
  const weaves = join(root, 'weaves')
  const dir = join(weaves, slug)
  const shown = `weaves/${slug}/weave.yaml`
  const path = join(dir, 'weave.yaml')
  for (const folder of [weaves, dir]) {
    const info = entry(folder)
    if (info && !info.isDirectory()) throw new Refusal(`${folder === weaves ? 'weaves' : `weaves/${slug}`} must be a real folder`)
  }

  const catalogue = join(root, 'catalogue.yaml')
  if (!entry(catalogue)) {
    if (subject !== undefined) throw new Refusal('--subject needs a catalogue.yaml in the current folder')
    mkdirSync(dir, { recursive: true })
    writeNew(path, shown, stringify(data, { lineWidth: 0 }))
    return [`wrote ${shown}`]
  }

  // Serialize catalogue updates by this command and stage the replacement beside the original for an atomic rename.
  const lock = join(root, '.openquarry-catalogue.lock')
  try {
    mkdirSync(lock)
  } catch (error) {
    if (error.code === 'EEXIST') throw new Refusal('another course creation is updating catalogue.yaml: try again when it finishes')
    throw error
  }
  const staged = join(lock, 'catalogue.yaml')
  try {
    const { text, updated, mode } = updateCatalogue(catalogue, slug, subject)
    writeFileSync(staged, updated, { flag: 'wx' })
    chmodSync(staged, mode & 0o777)
    mkdirSync(dir, { recursive: true })
    writeNew(path, shown, stringify(data, { lineWidth: 0 }))
    try {
      if (!entry(catalogue)?.isFile() || readPlain(catalogue) !== text) {
        throw new Refusal('catalogue.yaml changed while adding the course: try again')
      }
      renameSync(staged, catalogue)
    } catch (error) {
      rmSync(path)
      throw error
    }
  } finally {
    rmSync(staged, { force: true })
    rmdirSync(lock)
  }
  return [`wrote ${shown}`, 'updated catalogue.yaml']
}
