import { describe, expect, it } from 'vitest'
import {
  type ThreadFrontmatter,
  validateFabricManifest,
  validateLoom,
  validateThreadFrontmatter,
  validateWeave,
} from '../src/index.js'

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
    expect(validateThreadFrontmatter(thread)).toEqual({ valid: true, errors: [] })
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
