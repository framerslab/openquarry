import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { afterAll, describe, expect, it } from 'vitest'
import { buildSite, schemaFiles, ORIGIN, SCHEMA_PATH } from '../scripts/build-site.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const out = mkdtempSync(join(tmpdir(), 'openquarry-site-'))
const index = buildSite(out)
const site = join(out, 'site')
const served = join(site, 'schema', 'v1')
const source = JSON.parse(readFileSync(join(root, 'schema', 'SOURCE.json'), 'utf8')) as { commit: string; files: Record<string, string> }

afterAll(() => rmSync(out, { recursive: true, force: true }))

describe('the schema host', () => {
  it('serves each schema as JSON at its $id and as its YAML source, byte for byte', () => {
    const files = schemaFiles()
    expect(files).toHaveLength(6)
    for (const file of files) {
      const name = file.replace(/\.yaml$/, '')
      const json = JSON.parse(readFileSync(join(served, `${name}.json`), 'utf8')) as Record<string, unknown>
      expect(json.$id).toBe(`${ORIGIN}${SCHEMA_PATH}${name}.json`)
      const { $id, ...rest } = json
      expect(rest).toEqual(yaml.load(readFileSync(join(root, 'schema', file), 'utf8')))
      const copy = readFileSync(join(served, file), 'utf8')
      expect(createHash('sha256').update(copy).digest('hex')).toBe(source.files[file])
    }
  })

  it('lists the six schemas, their corpus commit and the package in the index', () => {
    const idx = JSON.parse(readFileSync(join(served, 'index.json'), 'utf8'))
    expect(idx.schemas.map((s: { name: string }) => s.name)).toEqual(schemaFiles().map((f) => f.replace(/\.yaml$/, '')))
    expect(idx.source.commit).toBe(source.commit)
    expect(idx.package.name).toBe('@framers/openquarry')
    expect(idx).toEqual(index)
  })

  it('opens the schemas to every origin and sends the root to the repository', () => {
    const headers = readFileSync(join(site, '_headers'), 'utf8')
    expect(headers).toMatch(/^\/schema\/\*\n {2}Access-Control-Allow-Origin: \*/m)
    const redirects = readFileSync(join(site, '_redirects'), 'utf8')
    expect(redirects).toContain('/ https://github.com/framerslab/openquarry 302')
    expect(redirects).toContain('/schema/v1 /schema/v1/index.json 302')
  })

  it('redirects the .io hosts and www to openquarry.dev in the middleware and lets the rest through', async () => {
    const mod = (await import(join(out, 'functions', '_middleware.js'))) as {
      onRequest: (c: { request: Request; next: () => Promise<Response> }) => Promise<Response>
    }
    const call = (url: string) => mod.onRequest({ request: new Request(url), next: async () => new Response('asset') })
    const io = await call('https://openquarry.io/schema/v1/index.json')
    expect(io.status).toBe(301)
    expect(io.headers.get('location')).toBe('https://openquarry.dev/schema/v1/index.json')
    const www = await call('https://www.openquarry.dev/schema/v1/thread.schema.json?x=1')
    expect(www.headers.get('location')).toBe('https://openquarry.dev/schema/v1/thread.schema.json?x=1')
    const home = await call('https://openquarry.dev/schema/v1/index.json')
    expect(home.status).toBe(200)
  })
})
