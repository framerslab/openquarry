// What 0.2.0 read, 0.3.0 reads. The course layer adds an optional `kind` to the weave and the loom and one new record,
// the catalogue; it changes nothing else. These tests hold the schema files to the bytes 0.2.0 shipped and run 0.2.0's
// own examples through the validators.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
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

const schemaDir = join(fileURLToPath(new URL('..', import.meta.url)), 'schema')
const read = (file: string) => readFileSync(join(schemaDir, file), 'utf8')
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')

// The SHA-256 of each schema file in @framers/openquarry 0.2.0, from that version's schema/SOURCE.json.
const AT_0_2_0: Record<string, string> = {
  'blocks-index.schema.yaml': '78bf128adb172d522333fc89e47fe0d89b2b96073e12a0671c3587bf4b87bea2',
  'fabric.schema.yaml': '290ee1b0eed8debaf1ff458cf94806bd9bb8eaf0dacd5cd2bfdab15690de9b8a',
  'loom.schema.yaml': '761e668f0ebb52ccf34d6833ee466ac556d000b1fbfa2f95bcb0174450fecc9e',
  'strand.schema.yaml': 'f6f217484f03793046861d8b152804382eeba58f98c49cae3a8560bb55e34ce8',
  'thread.schema.yaml': '1af37f95bb61532c102ab2a30c0250a6e2375afe20228dd1b50b40c17e28e766',
  'weave.schema.yaml': 'a37d65837e73f6a72ac2bec5746a9db8724d25c500e4c1c6dc89d10444197b29',
}

/** A schema file with its top-level `kind` property taken out: the `  kind:` line and the lines indented under it. */
function withoutKind(text: string): string {
  const kept: string[] = []
  let inside = false
  for (const line of text.split('\n')) {
    if (line.startsWith('  kind:')) {
      inside = true
    } else if (!(inside && line.startsWith('    '))) {
      inside = false
      kept.push(line)
    }
  }
  return kept.join('\n')
}

/** The validator a 0.2.0 reader holds: the schema as 0.2.0 shipped it, which has no `kind`. */
function readerAt020(schema: Record<string, unknown>) {
  const { kind: _kind, ...properties } = schema.properties as Record<string, unknown>
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  addFormats(ajv)
  return ajv.compile({ ...schema, properties })
}

describe('the schema files, against 0.2.0', () => {
  it('keep the thread, the strand copy, the manifest and the blocks index byte for byte', () => {
    for (const file of ['blocks-index.schema.yaml', 'fabric.schema.yaml', 'strand.schema.yaml', 'thread.schema.yaml']) {
      expect(sha256(read(file)), file).toBe(AT_0_2_0[file])
    }
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

describe('a reader built on 0.2.0', () => {
  it('reads a weave of kind course and a loom of kind unit', () => {
    const weave = readerAt020(weaveSchema)
    const loom = readerAt020(loomSchema)
    expect(weave({ slug: 'reading-a-map', title: 'Reading a map', kind: 'course', license: 'MIT' })).toBe(true)
    expect(loom({ slug: 'the-map', title: 'The map', kind: 'unit', ordering: 'manual' })).toBe(true)
  })
})
