// Writes the schema host served at https://openquarry.dev: the format's JSON Schemas at stable $id addresses, their
// YAML sources byte for byte, an index, and the host's headers, redirects and middleware. CI builds it as the `site`
// artifact; the deploy uploads dist-site/site with dist-site/functions beside it.
//   node scripts/build-site.mjs [out dir]        (default dist-site/)
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { writePages } from './site-pages.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

export const ORIGIN = 'https://openquarry.dev'
export const SCHEMA_PATH = '/schema/v1/'
export const REPOSITORY = 'https://github.com/framerslab/openquarry'
export const NPM = 'https://www.npmjs.com/package/openquarry'
const LIBRARY_NPM = 'https://www.npmjs.com/package/@framers/openquarry'

const HEADERS = `/schema/*
  Access-Control-Allow-Origin: *
  Cache-Control: public, max-age=300
  X-Content-Type-Options: nosniff
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
`

const REDIRECTS = `/schema /schema/ 301
/schema/v1 /schema/v1/index.json 302
/schema/v1/ /schema/v1/index.json 302
/npm ${NPM} 302
`

// The one host is openquarry.dev. The .io names and www answer with a permanent redirect to the same path there.
const MIDDLEWARE = `const HOME = 'openquarry.dev'
const ELSEWHERE = new Set(['openquarry.io', 'www.openquarry.io', 'www.openquarry.dev'])

export async function onRequest(context) {
  const url = new URL(context.request.url)
  if (ELSEWHERE.has(url.hostname)) {
    url.hostname = HOME
    url.protocol = 'https:'
    return Response.redirect(url.toString(), 301)
  }
  return context.next()
}
`

// The version the schema index names: npm's newest when the build asks for it (CI sets OPENQUARRY_SITE_NPM_VERSION=1, since the
// daily release publishes a new version without a commit), otherwise the repository's package.json. An npm that does not
// answer leaves the repository's version.
export function siteVersion(pkg) {
  if (process.env.OPENQUARRY_SITE_NPM_VERSION !== '1') return pkg.version
  try {
    const latest = JSON.parse(execFileSync('npm', ['view', pkg.name, 'dist-tags.latest', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 30000 }))
    return typeof latest === 'string' && /^\d+\.\d+\.\d+$/.test(latest) ? latest : pkg.version
  } catch {
    return pkg.version
  }
}

export function schemaFiles() {
  const primary = 'thread.schema.yaml'
  const alias = 'strand.schema.yaml'
  const files = readdirSync(join(root, 'schema')).filter((file) => file.endsWith('.schema.yaml')).sort()
  return [primary, ...files.filter((file) => file !== primary && file !== alias), alias]
}

function latestChangeDate(paths) {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cs', '--', ...paths], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    // Builds from source archives can omit the last modification date.
    return ''
  }
}

export function buildSite(out = join(root, 'dist-site')) {
  rmSync(out, { recursive: true, force: true })
  const site = join(out, 'site')
  const served = join(site, 'schema', 'v1')
  mkdirSync(served, { recursive: true })
  mkdirSync(join(out, 'functions'), { recursive: true })
  const source = JSON.parse(readFileSync(join(root, 'schema', 'SOURCE.json'), 'utf8'))
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  const schemas = []
  for (const file of schemaFiles()) {
    const text = readFileSync(join(root, 'schema', file), 'utf8')
    const name = file.replace(/\.yaml$/, '')
    const url = `${ORIGIN}${SCHEMA_PATH}${name}.json`
    const schema = yaml.load(text)
    // $id goes right after $schema; everything else is the YAML file's content, unchanged.
    const withId = { $schema: schema.$schema, $id: url, ...schema }
    writeFileSync(join(served, `${name}.json`), JSON.stringify(withId, null, 2) + '\n')
    writeFileSync(join(served, file), text)
    schemas.push({
      name,
      title: schema.title,
      url,
      yaml: `${ORIGIN}${SCHEMA_PATH}${file}`,
      sha256: createHash('sha256').update(text).digest('hex'),
      ...(name === 'strand.schema' ? { deprecated: schema.deprecated, aliasOf: 'thread.schema' } : {}),
    })
  }
  const index = {
    format: 'openquarry',
    schemas,
    source: { repository: source.repository, commit: source.commit, path: source.path },
    package: { name: pkg.name, version: siteVersion(pkg), npm: LIBRARY_NPM },
    repository: REPOSITORY,
    builtFrom: process.env.GITHUB_SHA || 'local',
  }
  writeFileSync(join(served, 'index.json'), JSON.stringify(index, null, 2) + '\n')
  writeFileSync(join(site, '_headers'), HEADERS)
  writeFileSync(join(site, '_redirects'), REDIRECTS)
  writeFileSync(join(site, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}/sitemap.xml\n`)
  writePages(site, index, latestChangeDate)
  writeFileSync(join(out, 'functions', '_middleware.js'), MIDDLEWARE)
  return index
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const index = buildSite(process.argv[2] ? join(process.cwd(), process.argv[2]) : undefined)
  console.log(`${index.schemas.length} schemas written for ${ORIGIN}${SCHEMA_PATH} (package ${index.package.version}, corpus ${index.source.commit.slice(0, 7)})`)
}
