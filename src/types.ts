/**
 * TypeScript types for the OpenQuarry format. They describe the files the JSON Schemas in schema/ validate:
 * a fabric's optional fabric.yaml, a weave's weave.yaml, a loom's loom.yaml and a thread's frontmatter.
 */

/**
 * A node's level in a fabric. These are stored values: a thread is stored as 'strand', and readers show it as a
 * thread. Changing a stored value would orphan saved data, so the format keeps it.
 */
export type KnowledgeNodeType = 'fabric' | 'weave' | 'loom' | 'strand'

/** The type of a typed link between two threads. */
export type LinkType =
  | 'extends'
  | 'contrasts'
  | 'supports'
  | 'example-of'
  | 'implements'
  | 'questions'
  | 'refines'
  | 'applies'
  | 'summarizes'
  | 'prerequisite'
  | 'related'
  | 'follows'
  | 'references'
  | 'contradicts'
  | 'updates'
  | 'parallels'
  | 'synthesizes'
  | 'custom'

/** A typed link from one thread to another, one entry of a `relationships:` list. */
export interface ThreadLink {
  /** The target thread's slug, as Quarry writes it. */
  target?: string
  /** The target thread's slug, as older corpora write it. */
  targetSlug?: string
  type?: LinkType
  /** How strongly the two threads relate, from 0 to 1. */
  strength?: number
  bidirectional?: boolean
  context?: string
}

/** Slugs of linked threads grouped by kind, the other shape `relationships:` takes. */
export interface ThreadLinkGroups {
  prerequisites?: string[]
  requires?: string[]
  references?: string[]
  seeAlso?: string[]
}

export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert'

export type ContentType =
  | 'lesson'
  | 'reference'
  | 'exercise'
  | 'assessment'
  | 'project'
  | 'discussion'
  | 'resource'
  | 'markdown'
  | 'code'
  | 'data'
  | 'media'

/** A skill in a skill vocabulary, for example `{ id: 'qs/library/skill/slope', name: 'Slope' }`. */
export interface SkillReference {
  id: string
  name: string
}

/** A suggested tag on a block, with where the suggestion came from. */
export interface SuggestedTag {
  tag: string
  /** From 0 to 1. */
  confidence: number
  source: 'inline' | 'nlp' | 'llm' | 'existing' | 'user'
  reasoning?: string
}

/** A block of a thread (a heading, a paragraph, a list and so on), with its tags. */
export interface ThreadBlock {
  /** A heading's slug, or a generated id such as `block-42`. */
  id: string
  /** The block's first line in the Markdown file, from 1. */
  line: number
  endLine?: number
  type: 'heading' | 'paragraph' | 'code' | 'list' | 'blockquote' | 'table' | 'html'
  headingLevel?: number
  tags?: string[]
  suggestedTags?: SuggestedTag[]
  worthiness?: {
    score?: number
    signals?: {
      topicShift?: number
      entityDensity?: number
      semanticNovelty?: number
      structuralImportance?: number
    }
  }
  extractiveSummary?: string
  warrantsIllustration?: boolean
  [key: string]: unknown
}

/** A thread's frontmatter: the YAML block at the top of a note's Markdown file. */
export interface ThreadFrontmatter {
  id: string
  slug: string
  title: string
  /** A semantic version, for example `1.0.0`. */
  version: string
  contentType: ContentType
  summary?: string
  extractiveSummary?: string
  aiSummary?: string
  /** Curated notes: a list of short notes, or one note as text. The key keeps its name. */
  notes?: string | string[]
  difficulty?:
    | DifficultyLevel
    | { overall?: DifficultyLevel; cognitive?: number; prerequisites?: number; conceptual?: number }
  taxonomy?: {
    subjects?: string[]
    topics?: string[]
    subject?: string[]
    topic?: string[]
    subtopic?: string[]
    concepts?: Array<{ term?: string; weight?: number }>
  }
  /** Links to other threads: slugs grouped by kind, or a list of typed links. The key keeps its name. */
  relationships?: ThreadLinkGroups | ThreadLink[]
  /** Ids of the skills this thread teaches. */
  teaches?: string[]
  /** Ids of the skills this thread assumes a reader already has. */
  requires?: string[]
  publishing?: {
    status?: 'draft' | 'review' | 'published' | 'archived'
    license?: string
    lastUpdated?: string
  }
  blocks?: ThreadBlock[]
  [key: string]: unknown
}

/** A loom's loom.yaml: a folder inside a weave. */
export interface Loom {
  slug: string
  title: string
  summary?: string
  tags?: string[]
  ordering?: 'manual' | 'alpha' | 'date' | 'weight'
  relationships?: Array<{
    targetSlug?: string
    type?: 'follows' | 'parallels' | 'contrasts' | 'extends' | 'applies'
    strength?: number
  }>
  [key: string]: unknown
}

/** A weave's weave.yaml: a knowledge base. */
export interface Weave {
  slug: string
  title: string
  description?: string
  maintainedBy?: string
  license?: string
  tags?: string[]
  [key: string]: unknown
}

/**
 * The optional fabric.yaml at a fabric's root. A folder or repository that holds `weaves/` is a fabric with or without
 * it, and a missing manifest reads as version 1.
 */
export interface FabricManifest {
  format: 'openquarry'
  name?: string
  /**
   * 1: the file names before the thread rename (strand.schema.yaml, and the `looms/` and `strands/` prefix folders).
   * 2: the thread names (thread.schema.yaml; the prefix folders are still read).
   */
  version: 1 | 2
}

/** @deprecated Use ThreadFrontmatter. The format's note type was called StrandFrontmatter before the thread rename. */
export type StrandFrontmatter = ThreadFrontmatter
