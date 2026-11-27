// What 0.2.0 read, 0.3.0 reads. The course layer adds an optional `kind` to the weave and the loom and one new record,
// the catalogue. These tests run 0.2.0's examples through the validators and check the retained schema bytes.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import {
  loomSchema,
  validateFabricManifest,
  validateLoom,
  validateThreadFrontmatter,
  validateWeave,
  weaveSchema,
} from '../src/index.js'
import { AT_0_2_0, readerAt020, withoutKind } from './reader-020.js'

const schemaDir = join(fileURLToPath(new URL('..', import.meta.url)), 'schema')
const read = (file: string) => readFileSync(join(schemaDir, file), 'utf8')
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

describe('the schema files, against 0.2.0', () => {
  it('keeps the canonical thread schema byte for byte', () => {
    const file = 'thread.schema.yaml'
    expect(sha256(read(file)), file).toBe(AT_0_2_0[file])
  })

  it('add kind to the weave and the loom and change no other byte', () => {
    for (const file of ['loom.schema.yaml', 'weave.schema.yaml']) {
      const text = read(file)
      expect((yaml.load(text) as { properties: Record<string, unknown> }).properties.kind, file).toBeDefined()
      expect(sha256(withoutKind(text)), file).toBe(AT_0_2_0[file])
    }
  })

  it('leave kind optional', () => {
    expect(weaveSchema.required).toEqual(['slug', 'title'])
    expect(loomSchema.required).toEqual(['slug', 'title'])
  })
})

describe("0.2.0's examples", () => {
  // The frontmatter of the 0.2.0 README.
  const readmeThread = {
    id: '3fce914f-0801-45fd-b886-f0521aeeb4a1',
    slug: 'architecture-overview',
    title: 'Architecture overview',
    version: '1.0.0',
    contentType: 'reference',
    relationships: { references: ['nlp-pipeline', 'sql-cache-architecture'] },
  }

  it('validate unchanged', () => {
    expect(validateThreadFrontmatter(readmeThread)).toEqual({ valid: true, errors: [] })
    expect(
      validateThreadFrontmatter({
        ...readmeThread,
        summary: 'How the corpus is laid out.',
        difficulty: 'intermediate',
        taxonomy: { subjects: ['technology'], topics: ['architecture'] },
        teaches: ['qs/library/skill/slope'],
        requires: ['qs/library/skill/linear-equation'],
        publishing: { status: 'published', license: 'MIT' },
      }),
    ).toEqual({ valid: true, errors: [] })
    expect(
      validateLoom({
        slug: 'frame',
        title: 'Frame',
        summary: 'The Frame loom.',
        ordering: 'manual',
        relationships: [{ targetSlug: 'architecture', type: 'parallels', strength: 0.7 }],
      }),
    ).toEqual({ valid: true, errors: [] })
    expect(validateWeave({ slug: 'wiki', title: 'Frame Wiki', description: 'The wiki weave.', license: 'MIT' })).toEqual({
      valid: true,
      errors: [],
    })
    expect(validateFabricManifest({ format: 'openquarry', version: 1 })).toEqual({ valid: true, errors: [] })
    expect(validateFabricManifest({ format: 'openquarry', name: 'Frame Codex', version: 2 })).toEqual({
      valid: true,
      errors: [],
    })
  })

  it('fail with the lines the 0.2.0 README gives', () => {
    const { id: _id, ...withoutId } = readmeThread
    expect(validateThreadFrontmatter(withoutId)).toEqual({ valid: false, errors: ["/ must have required property 'id'"] })
    expect(validateThreadFrontmatter({ ...readmeThread, contentType: 'essay' }).errors).toEqual([
      '/contentType must be equal to one of the allowed values: "lesson", "reference", "exercise", "assessment", "project", "discussion", "resource", "markdown", "code", "data", "media"',
    ])
  })
})

describe('a 0.2.0 file that already has a key named kind', () => {
  // 0.2.0's weave and loom refused no key they did not name, so a file could carry `kind` with any value. 0.3.0 gives
  // the key a meaning: a lowercase word validates as before, any other value is refused. The changelog says so.
  it('validates when its kind is a lowercase word, and is refused otherwise', () => {
    const weave = { slug: 'maps', title: 'Maps', kind: 'Course' }
    expect(readerAt020(weaveSchema)(weave)).toBe(true)
    expect(validateWeave(weave).errors).toEqual(['/kind must match pattern "^[a-z][a-z0-9-]*$"'])
    expect(validateWeave({ ...weave, kind: 'field-guide' })).toEqual({ valid: true, errors: [] })
    const loom = { slug: 'part-one', title: 'Part one', kind: 3 }
    expect(readerAt020(loomSchema)(loom)).toBe(true)
    expect(validateLoom(loom).errors).toEqual(['/kind must be string'])
  })
})

describe('a reader built on 0.2.0', () => {
  it('reads a weave of kind course and a loom of kind unit', () => {
    const weave = readerAt020(weaveSchema)
    const loom = readerAt020(loomSchema)
    expect(weave({ slug: 'reading-a-map', title: 'Reading a map', kind: 'course', license: 'MIT' })).toBe(true)
    expect(loom({ slug: 'the-map', title: 'The map', kind: 'unit', ordering: 'manual' })).toBe(true)
  })
})
