// The example course under examples/reading-a-map: a fabric with a catalogue and one weave of kind course, which holds
// two looms of kind unit and their lessons, exercises and assessment. Every file must pass the validator of its kind,
// and the links between the files must hold.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import {
  type Catalogue,
  type Loom,
  type ThreadFrontmatter,
  type Weave,
  loomSchema,
  validateCatalogue,
  validateFabricManifest,
  validateLoom,
  validateThreadFrontmatter,
  validateWeave,
  weaveSchema,
} from '../src/index.js'
import { readerAt020 } from './reader-020.js'

const fabric = join(fileURLToPath(new URL('..', import.meta.url)), 'examples', 'reading-a-map')
const readYaml = (...path: string[]) => yaml.load(readFileSync(join(fabric, ...path), 'utf8'))

/** The frontmatter of a thread file: the YAML between the two `---` lines at its top. */
function frontmatter(...path: string[]): unknown {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(readFileSync(join(fabric, ...path), 'utf8'))
  if (!match) throw new Error(`${path.join('/')} has no frontmatter`)
  return yaml.load(match[1])
}

const folders = (...path: string[]) =>
  readdirSync(join(fabric, ...path), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

const course = 'reading-a-map'
const units = existsSync(join(fabric, 'weaves', course)) ? folders('weaves', course) : []
const threads = units.flatMap((unit) =>
  readdirSync(join(fabric, 'weaves', course, unit))
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => ({ unit, file, data: frontmatter('weaves', course, unit, file) as ThreadFrontmatter })),
)

/** Each skill a thread requires that no lesson in the list teaches, as `unit/file requires skill`. */
function untaught(list: { unit: string; file: string; data: ThreadFrontmatter }[]): string[] {
  const lessons = list.filter(({ data }) => data.contentType === 'lesson')
  const taught = new Set(lessons.flatMap(({ data }) => data.teaches ?? []))
  return list.flatMap(({ unit, file, data }) =>
    (data.requires ?? []).filter((skill) => !taught.has(skill)).map((skill) => `${unit}/${file} requires ${skill}`),
  )
}

describe('the example course', () => {
  it('is a fabric with a manifest and a catalogue that lists its one weave', () => {
    expect(validateFabricManifest(readYaml('fabric.yaml'))).toEqual({ valid: true, errors: [] })
    const catalogue = readYaml('catalogue.yaml') as Catalogue
    expect(validateCatalogue(catalogue)).toEqual({ valid: true, errors: [] })
    expect(catalogue.entries.map((entry) => entry.slug)).toEqual(folders('weaves'))
    expect(folders('weaves')).toEqual([course])
  })

  it('is a weave of kind course that states its licence', () => {
    const weave = readYaml('weaves', course, 'weave.yaml') as Weave
    expect(validateWeave(weave)).toEqual({ valid: true, errors: [] })
    expect(weave.kind).toBe('course')
    expect(weave.slug).toBe(course)
    expect(weave.license).toBe('MIT')
  })

  it('holds two looms of kind unit, the second building on the first', () => {
    expect(units).toEqual(['finding-your-way', 'the-map'])
    for (const unit of units) {
      const loom = readYaml('weaves', course, unit, 'loom.yaml') as Loom
      expect(validateLoom(loom), unit).toEqual({ valid: true, errors: [] })
      expect(loom.kind, unit).toBe('unit')
      expect(loom.slug, unit).toBe(unit)
    }
    const second = readYaml('weaves', course, 'finding-your-way', 'loom.yaml') as Loom
    expect(second.relationships).toEqual([{ targetSlug: 'the-map', type: 'extends' }])
  })

  it('holds lessons, exercises and an assessment as threads, each with its own id', () => {
    expect(threads).toHaveLength(6)
    for (const { unit, file, data } of threads) {
      expect(validateThreadFrontmatter(data), `${unit}/${file}`).toEqual({ valid: true, errors: [] })
      expect(`${data.slug}.md`, `${unit}/${file}`).toBe(file)
    }
    expect(new Set(threads.map(({ data }) => data.id)).size).toBe(threads.length)
    const count = (contentType: string) => threads.filter(({ data }) => data.contentType === contentType).length
    expect({ lesson: count('lesson'), exercise: count('exercise'), assessment: count('assessment') }).toEqual({
      lesson: 3,
      exercise: 2,
      assessment: 1,
    })
  })

  it('links its threads by skill: every skill a thread requires, a lesson of the course teaches', () => {
    expect(untaught(threads)).toEqual([])
    for (const { unit, file, data } of threads) {
      if (data.contentType === 'lesson') expect(data.teaches?.length, `${unit}/${file}`).toBeGreaterThan(0)
      else expect(data.requires?.length, `${unit}/${file}`).toBeGreaterThan(0)
    }
  })

  it('counts a skill as taught only when a lesson teaches it', () => {
    const thread = (file: string, data: Partial<ThreadFrontmatter>) => ({ unit: 'the-map', file, data: data as ThreadFrontmatter })
    const drill = thread('drill.md', { contentType: 'exercise', teaches: ['map-scale'] })
    const quiz = thread('quiz.md', { contentType: 'assessment', requires: ['map-scale'] })
    expect(untaught([drill, quiz])).toEqual(['the-map/quiz.md requires map-scale'])
    const lesson = thread('lesson.md', { contentType: 'lesson', teaches: ['map-scale'] })
    expect(untaught([drill, lesson, quiz])).toEqual([])
  })

  it("files its threads under the catalogue's subjects", () => {
    const catalogue = readYaml('catalogue.yaml') as Catalogue
    const subjects = new Set(catalogue.subjects.map((subject) => subject.id))
    for (const { unit, file, data } of threads) {
      expect(data.taxonomy?.subjects?.length, `${unit}/${file}`).toBeGreaterThan(0)
      for (const subject of data.taxonomy?.subjects ?? []) expect(subjects.has(subject), `${unit}/${file}`).toBe(true)
    }
  })

  it('reads in a reader built on 0.2.0, which has no kind', () => {
    expect(readerAt020(weaveSchema)(readYaml('weaves', course, 'weave.yaml'))).toBe(true)
    for (const unit of units) expect(readerAt020(loomSchema)(readYaml('weaves', course, unit, 'loom.yaml')), unit).toBe(true)
  })
})
