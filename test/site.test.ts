import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { afterAll, describe, expect, it } from 'vitest'
import { buildSite, schemaFiles, ORIGIN, SCHEMA_PATH } from '../scripts/build-site.mjs'
import { highlight } from '../scripts/highlight.mjs'
import { beforeRelease, checkCommand, idCommand, initCommands, newCommands, startCommands, starters } from '../scripts/start-commands.mjs'

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
  it('writes all ten canonical pages, navigation and sitemap entries', () => {
    for (const path of ['', 'format', 'courses', 'llm', 'schema', 'validate', 'spiral', 'learning', 'package', 'about']) {
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
    for (const path of ['', 'courses', 'llm', 'schema', 'validate', 'spiral', 'learning']) {
      expect(readFileSync(join(site, path, 'index.html'), 'utf8')).not.toMatch(/strand\.schema|StrandFrontmatter|strands\//)
    }
    for (const font of ['HankenGrotesk', 'Fraunces', 'JetBrainsMono']) {
      expect(readFileSync(join(site, `fonts/${font}-OFL.txt`), 'utf8')).toContain('SIL OPEN FONT LICENSE')
    }
  })
  it('carries the mark, the GitHub key, who makes it and who uses it on every page', () => {
    for (const path of ['', 'format', 'courses', 'llm', 'schema', 'validate', 'spiral', 'learning', 'package', 'about']) {
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
  it('pairs the notes and course destinations in the landing hero, Format guide and course example', () => {
    for (const [path, region] of [
      ['', /<section class="hero">([\s\S]*?)<\/section>/],
      ['format', /<h2>One real file<\/h2>([\s\S]*?)<(?:h2|details) id="version-1-fabrics">/],
      ['courses', /<h2 id="the-example">The example<\/h2>([\s\S]*?)<h2 id="the-course-a-weave-of-kind-course">/],
    ] as const) {
      const html = readFileSync(join(site, path, 'index.html'), 'utf8')
      const body = region.exec(html)?.[1] ?? ''
      const pair = /<ul class="product-links"[^>]*>([\s\S]*?)<\/ul>/.exec(body)?.[1]
      expect(pair, `${path || 'landing hero'} has no notes and course CTA pair`).toBeDefined()
      expect(pair).toMatch(/href="https:\/\/quarry\.space">See notes in Quarry[\s\S]*?Quarry reads your notes in the format\./)
      expect(pair).toMatch(/href="https:\/\/quarry\.school">See courses in Quarry School[\s\S]*?Each course is a weave, each unit a loom, each lesson a thread\./)
    }
  })
  it('keeps version 1 names in compatibility material and checks a saved thread index in the package example', () => {
    const format = readFileSync(join(site, 'format', 'index.html'), 'utf8')
    const compatibility = /<details id="version-1-fabrics">([\s\S]*?)<\/details>/.exec(format)
    expect(compatibility?.[1], 'the Format guide has no Version 1 fabrics disclosure').toBeDefined()
    expect(compatibility?.[1]).toContain('/schema/v1/strand.schema.json')
    expect(format.replace(compatibility?.[0] ?? '', '')).not.toMatch(/strand\.schema|StrandFrontmatter|strands\//)

    const page = readFileSync(join(site, 'package', 'index.html'), 'utf8')
    const example = /<h2 id="blocks-index">([\s\S]*?)<h2 id="json-schema">/.exec(page)?.[1]
    expect(example, 'the package page has no blocks-index example').toBeDefined()
    expect(example).toContain('node blocks.mjs blocks-index.json')
    expect(example).not.toMatch(/totalStrands|strandPath|\bstrands\b/)
  })
  it('documents optional validator warnings and the version 1 blocks index result on the package page', () => {
    const page = readFileSync(join(site, 'package', 'index.html'), 'utf8')
    const exports = /<h2 id="exports">[^<]*<\/h2>([\s\S]*?)<h2/.exec(page)?.[1]
    expect(exports).toContain('optional <code>warnings</code>')
    expect(exports).toContain('<code>validateBlocksIndex</code> returns only <code>{ valid, errors }</code> for version 1 indexes')
  })
  it('gives the landing a GitHub key, the project badges and a card for Frame', () => {
    const home = readFileSync(join(site, 'index.html'), 'utf8')
    const actions = /<div class="actions">([\s\S]*?)<\/div>/.exec(home)?.[1] ?? ''
    expect(actions).toContain('<a class="button" href="/format/"><span class="wide">Read the format</span>')
    expect(actions).toContain('<a class="key" href="/package/">npm package</a>')
    expect(actions).toContain('<a class="key" href="https://github.com/framerslab/openquarry">')
    // The version on the npm badge is the package's own, read at build time.
    expect(home).toContain(`<a href="https://www.npmjs.com/package/@framers/openquarry"><span>npm</span><strong>${index.package.version}</strong></a>`)
    expect(home).toContain('<span>licence</span><strong>MIT</strong>')
    expect(home).toContain('<span>JSON Schema</span><strong>2020-12</strong>')
    expect(home).toContain('<a class="card" href="https://frame.dev">')
    expect(home).toContain('<a href="/about/">About OpenQuarry: who makes it and why</a>')
    const about = readFileSync(join(site, 'about', 'index.html'), 'utf8')
    expect(/<div class="actions">([\s\S]*?)<\/div>/.exec(about)?.[1]).toContain('<a class="key" href="https://frame.dev">')
    expect(about).toContain('It is a Framers Lab project.')
    expect(about).not.toContain('Manic Agency')
    expect(about).not.toContain('the team behind')
    expect(about).not.toContain('Manic Agency LLC')
  })
  it('gives the package a page: the install lines, every export with an example, and its links', () => {
    const home = readFileSync(join(site, 'index.html'), 'utf8')
    const install = /<section class="install"[\s\S]*?<\/section>/.exec(home)?.[0] ?? ''
    expect(install).toContain('<span class="t-key">npm</span> install @framers/openquarry')
    expect(install).toContain('<a href="/package/">')
    expect(install).toContain('data-copy')
    const page = readFileSync(join(site, 'package', 'index.html'), 'utf8')
    for (const line of ['npm install @framers/openquarry', 'pnpm add @framers/openquarry', 'yarn add @framers/openquarry']) {
      expect(page).toContain(line.replace(/^(\S+)/, '<span class="t-key">$1</span>'))
    }
    expect(page.match(/data-copy/g)!.length).toBeGreaterThan(10)
    expect(page).toContain(`<strong>${index.package.version}</strong>`)
    expect(page).toContain('<strong>MIT</strong>')
    for (const link of ['https://www.npmjs.com/package/@framers/openquarry', 'https://github.com/framerslab/openquarry', 'https://openquarry.dev/schema/v1/thread.schema.json', '/schema/v1/index.json', '/format/']) {
      expect(page, `the package page links ${link}`).toContain(`href="${link}"`)
    }
    expect(page).toContain('aria-current="page">Package</a>')
  })
  it('opens the package page with Start a project, each command with a copy key, and links to it from the landing and the format guide', () => {
    const page = readFileSync(join(site, 'package', 'index.html'), 'utf8')
    const start = /<section class="start"[\s\S]*?<\/section>/.exec(page)?.[0] ?? ''
    // The first section of the page, before the install lines and the exports.
    expect(page.indexOf('<h2 id="start">Start a project</h2>')).toBeGreaterThan(0)
    expect(page.indexOf('<h2 id="start">')).toBeLessThan(page.indexOf('<h2 id="install">'))
    const unescape = (s: string) => s.replace(/<[^>]+>/g, '').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&amp;', '&')
    const blocks = [...start.matchAll(/<figure class="code">[\s\S]*?<\/figure>/g)].map((m) => m[0])
    // The openquarry command leads: init for each starter, then check, new and id; the degit commands follow.
    const commands = [...starters.map((s) => initCommands(s)), checkCommand, newCommands.notes, newCommands.course, idCommand, ...starters.map((s) => startCommands(s))]
    expect(blocks.map((b) => unescape(/<code class="language-bash">([\s\S]*?)<\/code>/.exec(b)?.[1] ?? ''))).toEqual(commands)
    expect(commands[0].split('\n')[0]).toBe('npx openquarry init my-notes')
    for (const b of blocks) expect(b).toContain('data-copy')
    for (const id of ['start-notes', 'start-course', 'start-check', 'start-new', 'start-id', 'start-degit']) expect(start, id).toContain(`<h3 id="${id}">`)
    // Until the openquarry package is on npm, one sentence says so before the first command. The release removes it.
    if (beforeRelease) {
      const note = start.indexOf('<div class="callout before-release">')
      expect(note).toBeGreaterThan(start.indexOf('<h2 id="start">'))
      expect(note).toBeLessThan(start.indexOf('<figure class="code">'))
      expect(unescape(/<div class="callout before-release"><p>([\s\S]*?)<\/p><\/div>/.exec(start)?.[1] ?? '')).toBe(beforeRelease.text.replaceAll('`', ''))
    } else expect(page).not.toContain('not on npm yet')
    for (const link of ['https://www.npmjs.com/package/openquarry', 'https://github.com/framerslab/openquarry/tree/master/packages/openquarry#readme', 'https://github.com/framerslab/openquarry/tree/master/templates', 'https://github.com/framerslab/openquarry/tree/master/examples/reading-a-map', '/schema/', 'https://www.npmjs.com/package/@framers/openquarry', 'https://github.com/framerslab/openquarry']) {
      expect(start, `Start a project links ${link}`).toContain(`href="${link}"`)
    }
    const home = readFileSync(join(site, 'index.html'), 'utf8')
    expect(/<section class="install"[\s\S]*?<\/section>/.exec(home)?.[0]).toContain('<a href="/package/#start">Start a project</a>')
    expect(readFileSync(join(site, 'format', 'index.html'), 'utf8')).toContain('<a href="/package/#start">start a project from a starter</a>')
  })
  it('shows the start commands on the landing, above the install lines, and at the top of the Courses guide', () => {
    const unescape = (s: string) => s.replace(/<[^>]+>/g, '').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&amp;', '&')
    const commandsIn = (html: string) => [...html.matchAll(/<figure class="code">[\s\S]*?<\/figure>/g)].map((m) => unescape(/<code class="language-bash">([\s\S]*?)<\/code>/.exec(m[0])?.[1] ?? ''))
    const home = readFileSync(join(site, 'index.html'), 'utf8')
    const start = /<section class="start-home"[\s\S]*?<\/section>/.exec(home)?.[0] ?? ''
    expect(start).toContain('<h2 id="start-home-h">')
    expect(commandsIn(start)).toEqual(starters.map((s) => initCommands(s)))
    expect(commandsIn(start)[0].split('\n')[0]).toBe('npx openquarry init my-notes')
    expect(start.match(/data-copy/g)?.length).toBe(starters.length)
    for (const link of ['/package/#start', '/package/#start-degit', 'https://github.com/framerslab/openquarry/tree/master/templates', 'https://www.npmjs.com/package/openquarry']) {
      expect(start, `the landing's start section links ${link}`).toContain(`href="${link}"`)
    }
    // Right under the hero, before the install lines.
    expect(home.indexOf('<section class="start-home"')).toBeGreaterThan(home.indexOf('<section class="hero"'))
    expect(home.indexOf('<section class="start-home"')).toBeLessThan(home.indexOf('<section class="install"'))
    const courses = readFileSync(join(site, 'courses', 'index.html'), 'utf8')
    const startCourse = /<div class="start-course">[\s\S]*?<\/div>/.exec(courses)?.[0] ?? ''
    expect(commandsIn(startCourse)).toEqual([initCommands(starters.find((s) => s.id === 'course')!)])
    expect(startCourse).toContain('href="/package/#start"')
  })
  it('says on every page that the openquarry package carries the command, and nowhere that a command is missing or to come', () => {
    for (const path of ['', 'format', 'courses', 'llm', 'schema', 'validate', 'spiral', 'learning', 'package', 'about']) {
      const html = readFileSync(join(site, path, 'index.html'), 'utf8')
      for (const gone of ['npm create', 'no standalone CLI', 'no command-line tool']) expect(html, `${path || 'home'}: ${gone}`).not.toContain(gone)
    }
    expect(readFileSync(join(site, 'package', 'index.html'), 'utf8')).toContain('The command line is the <code>openquarry</code> package: <a href="#start">Start a project</a> shows it.')
    // Until the release, the Validate page says the package is not on npm yet before it names the command.
    const validate = readFileSync(join(site, 'validate', 'index.html'), 'utf8')
    if (beforeRelease) {
      expect(validate).toContain('<p>The <code>openquarry</code> package is not on npm yet. Once it is, <code>npx openquarry check</code> validates every file of a project: <a href="/package/#start">Start a project</a> shows it.')
      expect(validate.indexOf('not on npm yet')).toBeLessThan(validate.indexOf('npx openquarry check'))
    } else {
      expect(validate).toContain('<code>npx openquarry check</code> validates every file of a project: <a href="/package/#start-check">Start a project</a> shows it.')
      expect(validate).not.toContain('not on npm yet')
    }
    // Until the release, no paragraph on any page tells a reader to run the command before it says the package is not on
    // npm yet: a reader can land on any section by its address, and the name is free for anyone to take until then.
    if (beforeRelease) {
      for (const path of ['', 'format', 'courses', 'llm', 'schema', 'validate', 'spiral', 'learning', 'package', 'about']) {
        const html = readFileSync(join(site, path, 'index.html'), 'utf8')
        for (const paragraph of html.split('<p>').slice(1).map((text) => text.split('</p>')[0]).filter((text) => text.includes('npx openquarry'))) {
          const note = paragraph.indexOf('not on npm yet')
          expect(note, `${path || 'home'}: ${paragraph}`).toBeGreaterThan(-1)
          expect(note, `${path || 'home'}: ${paragraph}`).toBeLessThan(paragraph.indexOf('npx openquarry'))
        }
      }
      const commandLine = /<h2 id="command-line">[\s\S]*?<\/p>/.exec(readFileSync(join(site, 'package', 'index.html'), 'utf8'))?.[0] ?? ''
      expect(commandLine).toContain('The <code>openquarry</code> package is not on npm yet. Once it is, <code>npx openquarry check</code> checks every file of a project: <a href="#start">Start a project</a> shows it.')
    }
  })
  it('names the stylesheet and the script by their content, so a new build is never drawn with an old cached stylesheet', () => {
    for (const path of ['', 'learning', 'about']) {
      const html = readFileSync(join(site, path, 'index.html'), 'utf8')
      for (const name of ['style.css', 'site.js']) {
        const stamp = createHash('sha256').update(readFileSync(join(site, name))).digest('hex').slice(0, 10)
        expect(html, `${path} names ${name} by its content`).toContain(`"/${name}?v=${stamp}"`)
        expect(html).not.toContain(`"/${name}"`)
      }
    }
  })
  it('keeps the header to its own links and puts Used by, the blog and the changelog in the footer', () => {
    for (const path of ['', 'format', 'learning', 'package', 'about']) {
      const html = readFileSync(join(site, path, 'index.html'), 'utf8')
      const header = (/<header class="top">([\s\S]*?)<\/header>/.exec(html)?.[1] ?? '').replace(/<details class="menu">[\s\S]*?<\/details>/, '')
      expect(header, `${path} header`).not.toContain('used-by')
      expect(header, `${path} header`).not.toContain('href="https://quarry.school"')
      const footer = /<footer class="foot">([\s\S]*?)<\/footer>/.exec(html)?.[1] ?? ''
      expect(footer, `${path} footer`).toContain('<a href="https://frame.dev/blog/">Blog</a>')
      expect(footer, `${path} footer`).toContain('<a href="https://github.com/framerslab/openquarry/blob/master/CHANGELOG.md">Changelog</a>')
      expect(footer, `${path} footer`).toContain('<a href="https://quarry.school">Quarry School</a>')
    }
  })

  it('gives every page a menu that holds every link of the header, for the widths where the row cannot', () => {
    for (const path of ['', 'format', 'learning', 'about']) {
      const html = readFileSync(join(site, path, 'index.html'), 'utf8')
      const menu = /<details class="menu">([\s\S]*?)<\/details>/.exec(html)?.[1] ?? ''
      expect(menu).toContain('<summary class="menu-key" aria-label="Menu">')
      for (const href of ['/format/', '/learning/', '/schema/', '/about/', 'https://quarry.school', 'https://quarry.space', 'https://frame.dev', 'https://github.com/framerslab/openquarry']) {
        expect(menu, `${path} menu links ${href}`).toContain(`<a href="${href}"`)
      }
      // The look switch is in the menu too: the narrowest phones have no room for it in the row.
      expect(menu).toContain('data-theme-toggle')
    }
    const learning = readFileSync(join(site, 'learning', 'index.html'), 'utf8')
    expect(learning).toContain('<a href="/learning/" aria-current="page">Learning science</a>')
  })
  it('gives each learning finding its source and names only fields the thread schema has', () => {
    const page = readFileSync(join(site, 'learning', 'index.html'), 'utf8')
    expect(page.match(/<section class="finding"/g)).toHaveLength(7)
    for (const source of [
      'https://doi.org/10.1177/1529100612453266',
      'https://openlibrary.org/works/OL2976744W',
      'https://doi.org/10.1037/0033-2909.132.3.354',
      'https://doi.org/10.1111/j.1467-9280.2006.01693.x',
      'https://doi.org/10.1007/s11251-007-9015-8',
      'https://doi.org/10.1207/s1532690xci0201_3',
      'https://doi.org/10.1207/s15516709cog1202_4',
      'https://doi.org/10.1037/0022-0663.92.1.126',
      'https://eric.ed.gov/?id=ED053419',
    ]) {
      expect(page, `cites ${source}`).toContain(`href="${source}"`)
    }
    const schema = JSON.parse(readFileSync(join(served, 'thread.schema.json'), 'utf8')) as {
      properties: Record<string, { enum?: string[]; oneOf?: { enum?: string[]; items?: { properties: { type: { enum: string[] } } } }[] }>
    }
    for (const field of ['id', 'summary', 'contentType', 'difficulty', 'relationships', 'teaches', 'requires']) {
      expect(schema.properties, `the thread schema has ${field}`).toHaveProperty(field)
      expect(page).toContain(`<code>${field}</code>`)
    }
    for (const value of ['lesson', 'exercise', 'assessment']) expect(schema.properties.contentType.enum).toContain(value)
    const linkTypes = schema.properties.relationships.oneOf?.find((o) => o.items)?.items?.properties.type.enum ?? []
    for (const type of ['extends', 'applies', 'refines', 'prerequisite']) expect(linkTypes, `link type ${type}`).toContain(type)
    // The format schedules nothing: the page says so and never claims a review field.
    expect(page).toContain('The format does not schedule reviews.')
    const home = readFileSync(join(site, 'index.html'), 'utf8')
    expect(home).toContain('<a href="/learning/">The learning science behind the format</a>')
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
  it('highlights a file saved with Windows line endings and keeps every byte', () => {
    const text = '---\r\nid: a1\r\ntitle: Scale and distance\r\ntags: [maps]\r\n---\r\n\r\n# Scale\r\n\r\n- one `code`\r\n2. two\r\n'
    // An HTML parser turns a bare CR into a line feed, so a CR must reach the page as a character reference.
    const unescape = (s: string) => s.replace(/<[^>]+>/g, '').replaceAll('&#13;', '\r').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"').replaceAll('&amp;', '&')
    for (const lang of ['markdown', 'yaml']) {
      const html = highlight(text, lang)
      expect(html).not.toContain('\r')
      expect(unescape(html)).toBe(text)
    }
    expect(highlight(text, 'markdown')).toContain('<span class="t-key">title</span>')
  })
})
