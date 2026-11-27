import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  type BlocksIndex,
  type KnowledgeNodeType,
  type StrandFrontmatter,
  type ThreadFrontmatter,
  validateBlocksIndex,
  validateFabricManifest,
  validateLoom,
  validateThreadFrontmatter,
  validateWeave,
} from '../src/index.js'

const threadNode: KnowledgeNodeType = 'thread'
const legacyNode: KnowledgeNodeType = 'strand'
const labelsFromAnExistingReader: Record<KnowledgeNodeType, string> = {
  fabric: 'Fabric', weave: 'Weave', loom: 'Loom', strand: 'Thread',
}

describe('validateBlocksIndex', () => {
  const index = JSON.parse(readFileSync(new URL('./fixtures/blocks-index-v1-legacy.json', import.meta.url), 'utf8')) as Record<string, unknown>
  const path = 'weaves/reading-a-map/the-map/scale-and-distance.md'
  const current: BlocksIndex = {
    generatedAt: '2026-11-26T00:00:00Z',
    version: '1.0.0',
    stats: { totalThreads: 1, totalBlocks: 1, totalTags: 1, worthyBlocks: 0 },
    threads: { [path]: { path, blockCount: 1, blocks: [{ id: 'scale', line: 1, type: 'heading' }] } },
    tagIndex: { maps: [{ threadPath: path, blockId: 'scale' }] },
  }

  it('accepts thread names in a version 1 index', () => {
    expect(validateBlocksIndex(current)).toStrictEqual({ valid: true, errors: [] })
    expect([threadNode, legacyNode]).toEqual(['thread', 'strand'])
    expect(labelsFromAnExistingReader[legacyNode]).toBe('Thread')
  })

  it('returns the thread names when reading a legacy index without rewriting the input', () => {
    const input = structuredClone(index)
    const result = validateBlocksIndex(input, { normalize: true })
    expect(result).toMatchObject({
      valid: true,
      warnings: ['Deprecated fields: use threads, stats.totalThreads, tagIndex[].threadPath.'],
    })
    expect(result.value).not.toHaveProperty('strands')
    expect(result.value?.threads).toEqual(index.strands)
    expect(result.value?.stats).not.toHaveProperty('totalStrands')
    expect(result.value?.stats.totalThreads).toBe(1)
    expect(result.value?.tagIndex?.maps).toEqual([{ threadPath: path, blockId: 'scale' }])
    expect(input).toEqual(index)
  })

  it('uses the current value when both spellings are present', () => {
    const input = {
      ...current,
      strands: {},
      stats: { ...current.stats, totalStrands: 0 },
      tagIndex: { maps: [{ ...current.tagIndex?.maps[0], strandPath: 'other.md' }] },
    }
    expect(validateBlocksIndex(input, { normalize: true })).toMatchObject({ valid: true, value: current })
    expect(validateBlocksIndex({ ...input, strands: [] }).valid).toBe(false)
  })

  it.each([
    ['with a strandPath reference', index],
    ['with no tag references', { ...index, tagIndex: { maps: [] } }],
  ])('returns exactly valid and errors for a version 1 index %s', (_, input) => {
    expect(validateBlocksIndex(input)).toStrictEqual({ valid: true, errors: [] })
  })

  it('rejects a version 1 index whose strands is an array', () => {
    expect(validateBlocksIndex({ ...index, strands: [] })).toEqual({ valid: false, errors: ['/strands must be object'] })
  })
})

// The frontmatter shape the Frame Codex corpus stores (its rename fixture, 2026-10-07).
const thread: ThreadFrontmatter = {
  id: '3fce914f-0801-45fd-b886-f0521aeeb4a1',
  slug: 'architecture-overview',
  title: 'Architecture overview',
  summary: 'How the corpus is laid out.',
  version: '1.0.0',
  contentType: 'markdown',
  difficulty: 'intermediate',
  taxonomy: { subjects: ['technology', 'knowledge'], topics: ['architecture', 'getting-started'] },
  tags: ['architecture', 'weave', 'loom'],
  relationships: { references: ['sql-cache-architecture', 'nlp-pipeline', 'automation-workflows'] },
  publishing: { status: 'published' },
  blocks: [
    {
      id: 'architecture-overview',
      line: 2,
      endLine: 2,
      type: 'heading',
      headingLevel: 1,
      tags: [],
      suggestedTags: [{ tag: 'architecture', confidence: 0.7, source: 'nlp', reasoning: 'Vocabulary match: topics' }],
      worthiness: {
        score: 0.787,
        signals: { topicShift: 0.5, entityDensity: 0.8, semanticNovelty: 0.686, structuralImportance: 1 },
      },
    },
  ],
}

describe('validateThreadFrontmatter', () => {
  it('accepts the frontmatter the corpus stores', () => {
    const oldImport: StrandFrontmatter = thread
    expect(validateThreadFrontmatter(oldImport)).toEqual({ valid: true, errors: [] })
  })

  it('accepts typed links, a note as text, and the skill ids a thread teaches and requires', () => {
    const result = validateThreadFrontmatter({
      ...thread,
      notes: 'Read the hooks thread next.',
      relationships: [
        { target: 'react-hooks', type: 'supports' },
        { targetSlug: 'javascript-closures', type: 'references', strength: 0.7, bidirectional: false },
      ],
      teaches: ['qs/library/skill/slope'],
      requires: ['qs/library/skill/linear-equation'],
    })
    expect(result).toEqual({ valid: true, errors: [] })
  })

  it('names a missing required key', () => {
    const { id: _id, ...withoutId } = thread
    const result = validateThreadFrontmatter(withoutId)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain("/ must have required property 'id'")
  })

  it('refuses an unknown link type and a malformed id', () => {
    expect(validateThreadFrontmatter({ ...thread, relationships: [{ target: 'x', type: 'unrelated-to' }] }).valid).toBe(false)
    expect(validateThreadFrontmatter({ ...thread, id: 'not-a-uuid' }).valid).toBe(false)
  })
})

describe('validateFabricManifest', () => {
  it('returns current fabric field names for legacy and mixed inputs', () => {
    const manifest = { format: 'openquarry', version: 1 }
    expect(validateFabricManifest({ ...manifest, strand: 'old.md', strands: ['old.md'] })).toStrictEqual({ valid: true, errors: [] })
    expect(validateFabricManifest({
      ...manifest, strand: 'old.md', thread: 'new.md', strands: ['old.md'], strandPath: 'old.md',
    }, { normalize: true })).toStrictEqual({
      valid: true,
      errors: [],
      value: { ...manifest, thread: 'new.md', threads: ['old.md'], threadPath: 'old.md' },
      warnings: ['Deprecated fields: use thread, threads, threadPath.'],
    })
  })

  it('takes format openquarry and version 1 or 2', () => {
    expect(validateFabricManifest({ format: 'openquarry', name: 'Frame Codex', version: 2 }).valid).toBe(true)
    expect(validateFabricManifest({ format: 'openquarry', version: 1 }).valid).toBe(true)
    expect(validateFabricManifest({ format: 'openquarry', version: 3 }).valid).toBe(false)
    expect(validateFabricManifest({ format: 'openstrand', version: 1 }).valid).toBe(false)
  })
})

describe('validateLoom and validateWeave', () => {
  it('accept the manifests the corpus stores', () => {
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
  })

  it('refuse a slug with capitals', () => {
    expect(validateWeave({ slug: 'Wiki', title: 'Frame Wiki' }).valid).toBe(false)
  })
})

describe('kind', () => {
  it('makes a weave a course and a loom a unit', () => {
    expect(validateWeave({ slug: 'reading-a-map', title: 'Reading a map', kind: 'course', license: 'MIT' })).toEqual({
      valid: true,
      errors: [],
    })
    expect(validateLoom({ slug: 'the-map', title: 'The map', kind: 'unit', ordering: 'manual' })).toEqual({
      valid: true,
      errors: [],
    })
  })

  it("takes a publisher's own lowercase word", () => {
    expect(validateWeave({ slug: 'birds', title: 'Birds of the coast', kind: 'field-guide' }).valid).toBe(true)
    expect(validateLoom({ slug: 'week-1', title: 'Week 1', kind: 'week' }).valid).toBe(true)
  })

  it('names the pattern when a kind is not a lowercase word', () => {
    for (const kind of ['Course', 'two words', '2nd-year', '']) {
      const weave = validateWeave({ slug: 'reading-a-map', title: 'Reading a map', kind })
      expect(weave.valid, JSON.stringify(kind)).toBe(false)
      expect(weave.errors, JSON.stringify(kind)).toEqual(['/kind must match pattern "^[a-z][a-z0-9-]*$"'])
      const loom = validateLoom({ slug: 'the-map', title: 'The map', kind })
      expect(loom.valid, JSON.stringify(kind)).toBe(false)
      expect(loom.errors, JSON.stringify(kind)).toEqual(['/kind must match pattern "^[a-z][a-z0-9-]*$"'])
    }
  })

  it('refuses a kind that is not text', () => {
    expect(validateWeave({ slug: 'reading-a-map', title: 'Reading a map', kind: 7 }).errors).toEqual(['/kind must be string'])
    expect(validateLoom({ slug: 'the-map', title: 'The map', kind: ['unit'] }).errors).toEqual(['/kind must be string'])
  })
})

describe('error lines', () => {
  it('name the allowed values when a value is not one of them', () => {
    const result = validateThreadFrontmatter({ ...thread, publishing: { status: 'live' } })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain(
      '/publishing/status must be equal to one of the allowed values: "draft", "review", "published", "archived"',
    )
  })

  it('name the value a constant requires', () => {
    const result = validateFabricManifest({ format: 'openstrand', version: 1 })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('/format must be equal to constant: "openquarry"')
  })

  it('name numbers as numbers', () => {
    expect(validateFabricManifest({ format: 'openquarry', version: 3 }).errors).toContain(
      '/version must be equal to one of the allowed values: 1, 2',
    )
  })
})
