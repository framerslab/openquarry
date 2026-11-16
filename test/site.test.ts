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
    expect(files).toHaveLength(7)
    for (const file of files) {
      const name = file.replace(/\.yaml$/, '')
      const json = JSON.parse(readFileSync(join(served, `${name}.json`), 'utf8')) as Record<string, unknown>
      expect(json.$id).toBe(`${ORIGIN}${SCHEMA_PATH}${name}.json`)
      const { $id, ...rest } = json
      expect(rest).toEqual(yaml.load(readFileSync(join(root, 'schema', file), 'utf8')))
      const original = yaml.load(readFileSync(join(root, 'schema', file), 'utf8')) as Record<string, unknown>
      expect(readFileSync(join(served, `${name}.json`), 'utf8')).toBe(JSON.stringify({ $schema: original.$schema, $id: `${ORIGIN}${SCHEMA_PATH}${name}.json`, ...original }, null, 2) + '\n')
      const copy = readFileSync(join(served, file), 'utf8')
      expect(createHash('sha256').update(copy).digest('hex')).toBe(source.files[file])
    }
  })

  it('lists the seven schemas, their corpus commit and the package in the index', () => {
    const idx = JSON.parse(readFileSync(join(served, 'index.json'), 'utf8'))
    expect(idx.schemas.map((s: { name: string }) => s.name)).toEqual(schemaFiles().map((f) => f.replace(/\.yaml$/, '')))
    expect(idx.schemas.find((s: { name: string }) => s.name === 'catalogue.schema')).toEqual({
      name: 'catalogue.schema',
      title: 'Catalogue',
      url: 'https://openquarry.dev/schema/v1/catalogue.schema.json',
      yaml: 'https://openquarry.dev/schema/v1/catalogue.schema.yaml',
      sha256: source.files['catalogue.schema.yaml'],
    })
    expect(idx.source.commit).toBe(source.commit)
    expect(idx.package.name).toBe('@framers/openquarry')
    expect(idx).toEqual(index)
  })

  it('opens the schemas to every origin and serves the root landing', () => {
    const headers = readFileSync(join(site, '_headers'), 'utf8')
    expect(headers).toMatch(/^\/schema\/\*\n {2}Access-Control-Allow-Origin: \*/m)
    const redirects = readFileSync(join(site, '_redirects'), 'utf8')
    expect(redirects).not.toMatch(/^\/ /m)
    expect(redirects).not.toContain('/schema/ /schema/v1/index.json')
    expect(readFileSync(join(site, 'index.html'), 'utf8')).toContain('Notes and courses,')
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


describe('the public format site', () => {
  it('writes all eight canonical pages, navigation and sitemap entries', () => {
    for (const path of ['', 'format', 'courses', 'llm', 'schema', 'validate', 'spiral', 'about']) {
      const html = readFileSync(join(site, path, 'index.html'), 'utf8')
      const url = `${ORIGIN}/${path ? path + '/' : ''}`
      expect(html).toContain(`<link rel="canonical" href="${url}">`)
      expect(html).toContain('application/ld+json')
      expect(html).toContain('Skip to content')
      expect(readFileSync(join(site, 'sitemap.xml'), 'utf8')).toContain(`<loc>${url}</loc>`)
    }
  })
  it('answers an unknown address with a not-found page, so a mistyped schema URL is not served the landing', () => {
    const html = readFileSync(join(site, '404.html'), 'utf8')
    expect(html).toContain('Page not found')
    expect(html).toContain('<meta name="robots" content="noindex">')
    expect(html).not.toContain('rel="canonical"')
    expect(readFileSync(join(site, 'sitemap.xml'), 'utf8')).not.toContain('404')
  })
  it('uses the real example and labels unsupported reading depths as a proposal', () => {
    expect(readFileSync(join(site, 'index.html'), 'utf8')).toContain('70c967bf-2dba-4399-aef1-671174eb904f')
    const format = readFileSync(join(site, 'format/index.html'), 'utf8')
    expect(format).toContain('Proposal only.')
    expect(format).toContain('Version 1 fabrics')
    for (const path of ['', 'courses', 'llm', 'schema', 'validate', 'spiral']) {
      expect(readFileSync(join(site, path, 'index.html'), 'utf8')).not.toMatch(/strand\.schema|StrandFrontmatter|strands\//)
    }
    for (const font of ['HankenGrotesk', 'Fraunces', 'JetBrainsMono']) {
      expect(readFileSync(join(site, `fonts/${font}-OFL.txt`), 'utf8')).toContain('SIL OPEN FONT LICENSE')
    }
  })
  it('carries the mark, the GitHub key, who makes it and who uses it on every page', () => {
    for (const path of ['', 'format', 'courses', 'llm', 'schema', 'validate', 'spiral', 'about']) {
      const html = readFileSync(join(site, path, 'index.html'), 'utf8')
      for (const link of ['https://github.com/framerslab/openquarry', 'https://frame.dev', 'https://quarry.school', 'https://quarry.space']) {
        expect(html, `${path} links ${link}`).toContain(`href="${link}"`)
      }
      expect(html).toContain('<link rel="icon" href="/icon.svg" type="image/svg+xml">')
      expect(html).toContain('<meta property="og:image" content="https://openquarry.dev/og.png">')
    }
    const courses = readFileSync(join(site, 'courses', 'index.html'), 'utf8')
    expect(courses).toContain('<a href="/format/" class="in-section">Docs</a>')
    expect(courses.match(/aria-current="page"/g)).toHaveLength(1)
    const about = readFileSync(join(site, 'about', 'index.html'), 'utf8')
    expect(about).toContain('AboutPage')
    expect(about).toContain('Who makes it')
  })
  it('highlights code at build time, keeps its text exact and gives each block a copy key', () => {
    const home = readFileSync(join(site, 'index.html'), 'utf8')
    expect(home).toContain('<span class="t-key">id</span><span class="t-pun">:</span> <span class="t-str">70c967bf-2dba-4399-aef1-671174eb904f</span>')
    expect(home).toContain('data-copy')
    const unescape = (s: string) => s.replace(/<[^>]+>/g, '').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&amp;', '&')
    const blocks = [...home.matchAll(/<code class="language-[a-z]+">([\s\S]*?)<\/code>/g)].map((m) => unescape(m[1]))
    const sample = readFileSync(join(root, 'examples/reading-a-map/weaves/reading-a-map/the-map/scale-and-distance.md'), 'utf8')
    expect(blocks).toContain(sample)
  })
})
