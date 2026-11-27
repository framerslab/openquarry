import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
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

  it('keeps the deprecated annotation when a sync reads a quoted thread title and a description', () => {
    const checkout = mkdtempSync(join(root, '.schema-sync-'))
    try {
      const upstream = join(checkout, 'upstream')
      const upstreamSchemas = join(upstream, 'schema')
      mkdirSync(upstreamSchemas, { recursive: true })
      const thread = '$schema: "https://json-schema.org/draft/2020-12/schema"\ntitle: "ThreadFrontmatter"\ndescription: "A thread"\ntype: object\n'
      writeFileSync(join(upstreamSchemas, 'thread.schema.yaml'), thread)
      const git = (...args: string[]) => execFileSync('git', args, { cwd: upstream, stdio: 'pipe' })
      git('init', '--quiet')
      git('add', 'schema')
      git('-c', 'user.name=Schema fixture', '-c', 'user.email=fixture@example.com', 'commit', '--quiet', '-m', 'Add thread schema')
      cpSync(join(root, 'schema'), join(checkout, 'schema'), { recursive: true })
      mkdirSync(join(checkout, 'scripts'))
      mkdirSync(join(checkout, 'src'))
      for (const file of ['sync-schema.mjs', 'build-schemas.mjs']) {
        cpSync(join(root, 'scripts', file), join(checkout, 'scripts', file))
      }
      execFileSync(process.execPath, [join(checkout, 'scripts', 'sync-schema.mjs'), upstream])
      expect(readFileSync(join(checkout, 'schema', 'thread.schema.yaml'), 'utf8')).toBe(thread)
      const alias = yaml.load(readFileSync(join(checkout, 'schema', 'strand.schema.yaml'), 'utf8'))
      expect(alias).toMatchObject({ title: 'StrandFrontmatter', type: 'object', deprecated: true })
    } finally {
      rmSync(checkout, { recursive: true, force: true })
    }
  })
})
