import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import { renderSchemasModule } from '../scripts/build-schemas.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const schemaDir = join(root, 'schema')
const files = readdirSync(schemaDir).filter((file) => file.endsWith('.schema.yaml')).sort()
const load = (file: string) => yaml.load(readFileSync(join(schemaDir, file), 'utf8')) as Record<string, unknown>

describe('the schema files', () => {
  it('are the seven files of the format', () => {
    expect(files).toEqual([
      'blocks-index.schema.yaml',
      'catalogue.schema.yaml',
      'fabric.schema.yaml',
      'loom.schema.yaml',
      'strand.schema.yaml',
      'thread.schema.yaml',
      'weave.schema.yaml',
    ])
  })

  it('match the hashes recorded in schema/SOURCE.json', () => {
    const source = JSON.parse(readFileSync(join(schemaDir, 'SOURCE.json'), 'utf8')) as {
      repository: string
      commit: string
      files: Record<string, string>
    }
    expect(source.repository).toBe('framerslab/codex')
    expect(source.commit).toMatch(/^[0-9a-f]{40}$/)
    expect(Object.keys(source.files).sort()).toEqual(files)
    for (const file of files) {
      const digest = createHash('sha256').update(readFileSync(join(schemaDir, file))).digest('hex')
      expect(digest, file).toBe(source.files[file])
    }
  })

  it('are what src/schemas.ts was generated from', () => {
    expect(readFileSync(join(root, 'src', 'schemas.ts'), 'utf8')).toBe(renderSchemasModule())
  })

  it('keeps the old thread schema valid on its own and labels it deprecated', () => {
    const { title: threadTitle, description: _description, ...thread } = load('thread.schema.yaml')
    const { title: aliasTitle, description, deprecated, ...alias } = load('strand.schema.yaml')
    expect(threadTitle).toBe('ThreadFrontmatter')
    expect(aliasTitle).toBe('StrandFrontmatter')
    expect(deprecated).toBe(true)
    expect(description).toContain('thread.schema')
    expect(thread).toEqual(alias)
  })
})
