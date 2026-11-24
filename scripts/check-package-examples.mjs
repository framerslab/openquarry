// CI only: runs every example on the package page (openquarry.dev/package/) and the landing against the package from
// npm, and compares what each prints with the text the page shows under it. It also checks the page's list of exports
// against what the package exports. The package is installed at the version package.json names, the version the site
// describes; while that version is not on npm yet, the check uses this build, packed as npm would publish it.
//   node scripts/check-package-examples.mjs        (after npm run build)
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildSite } from './build-site.mjs'
import { packageExamples, quickExample } from './package-examples.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const dir = mkdtempSync(join(tmpdir(), 'openquarry-examples-'))
const run = (command, args) => execFileSync(command, args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
// A failed command: its exit status and everything it wrote, so a CI log shows why.
const failure = (error) => `exit ${error.status}\n${error.stdout || ''}${error.stderr || ''}`

try {
  let spec = `${pkg.name}@${pkg.version}`
  let published = ''
  // npm answers a version it has never published with no output, and a package it has never seen with E404. Any other
  // failure (the registry down, the network, output that is not JSON) stops the check, so it never quietly checks this
  // build in place of the published package.
  try { published = JSON.parse(run('npm', ['view', spec, 'version', '--json']) || '""') } catch (error) {
    if (!/\bE404\b/.test(`${error.stdout || ''}${error.stderr || ''}`)) throw Error(`npm view ${spec} failed: ${error.message}\n${failure(error)}`)
  }
  if (published !== pkg.version) {
    run('npm', ['pack', root, '--silent', '--pack-destination', dir])
    spec = join(dir, readdirSync(dir).find((name) => name.endsWith('.tgz')))
    console.log(`${pkg.name}@${pkg.version} is not on npm yet: checking this build, packed`)
  } else console.log(`Checking the examples against ${pkg.name}@${pkg.version} from npm`)

  const typescript = String(pkg.devDependencies.typescript).replace(/^\^/, '')
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'openquarry-examples', private: true, type: 'module' }, null, 2))
  run('npm', ['install', '--no-audit', '--no-fund', spec, 'yaml', 'ajv', 'ajv-formats', `typescript@${typescript}`])
  const installed = JSON.parse(readFileSync(join(dir, 'node_modules', '@framers', 'openquarry', 'package.json'), 'utf8')).version
  if (installed !== pkg.version) throw Error(`Installed ${installed}, expected ${pkg.version}`)

  const tsc = (file) => run(process.execPath, [join(dir, 'node_modules', 'typescript', 'bin', 'tsc'), '--noEmit', '--strict', '--skipLibCheck', '--target', 'es2022', '--module', 'nodenext', '--moduleResolution', 'nodenext', file])
  for (const example of [quickExample, ...packageExamples]) {
    const name = example.id || 'landing'
    writeFileSync(join(dir, example.file), example.code + '\n')
    const args = [example.file]
    if (example.fixture) args.push(join(root, example.fixture))
    if (example.lang === 'ts') {
      try { tsc(example.file) } catch (error) { throw Error(`${name}: the TypeScript example does not type-check\n${failure(error)}`) }
      args.unshift('--experimental-strip-types', '--no-warnings')
    }
    let printed
    try { printed = run(process.execPath, args) } catch (error) { throw Error(`${name}: ${example.file} failed\n${failure(error)}`) }
    if (printed.trimEnd() !== example.output) throw Error(`${name}: ${example.file} printed\n${printed}\nThe page shows\n${example.output}`)
    if (example.typeError) {
      const [from, to] = example.typeError
      if (!example.code.includes(from)) throw Error(`${name}: the code does not hold ${from}`)
      const file = example.file.replace(/\.ts$/, '-refused.ts')
      writeFileSync(join(dir, file), example.code.replace(from, to) + '\n')
      let refused = ''
      try { tsc(file) } catch (error) { refused = failure(error) }
      if (!refused.includes(to.split(': ')[1].replaceAll("'", ''))) throw Error(`${name}: TypeScript accepted ${to}\n${refused}`)
    }
    console.log(`ok ${name} (${example.file})`)
  }

  // The page lists every export of the package, and lists nothing the package lacks.
  const values = JSON.parse(run(process.execPath, ['--input-type=module', '-e', "console.log(JSON.stringify(Object.keys(await import('@framers/openquarry'))))"]))
  const declarations = readFileSync(join(dir, 'node_modules', '@framers', 'openquarry', 'dist', 'index.d.ts'), 'utf8')
  const types = [...(/export \{([^}]*)\};?\s*$/.exec(declarations)?.[1] ?? '').matchAll(/type (\w+)/g)].map((m) => m[1])
  const exported = new Set([...values, ...types])
  if (values.length === 0 || types.length === 0) throw Error('The package exports could not be read')
  const out = join(dir, 'site')
  buildSite(out)
  const page = readFileSync(join(out, 'site', 'package', 'index.html'), 'utf8')
  // Each item of the lists opens with the names it describes, then a colon: <li><code>a(x)</code>, <code>b</code>: ...
  const lists = [...page.matchAll(/<ul class="exports">([\s\S]*?)<\/ul>/g)].map((m) => m[1]).join('')
  const heads = [...lists.matchAll(/<li>((?:<code>[^<]*<\/code>(?:, )?)+):/g)].map((m) => m[1]).join('')
  const listed = new Set([...heads.matchAll(/<code>([A-Za-z]\w*)/g)].map((m) => m[1]))
  const missing = [...exported].filter((name) => !listed.has(name))
  const extra = [...listed].filter((name) => !exported.has(name))
  if (missing.length) throw Error(`The package page does not list: ${missing.join(', ')}`)
  if (extra.length) throw Error(`The package page lists what the package does not export: ${extra.join(', ')}`)
  if (!page.includes(`<strong>${pkg.version}</strong>`) || !page.includes(`<strong>${pkg.license}</strong>`)) throw Error('The package page lacks the version or the licence from package.json')
  console.log(`ok the package page lists all ${exported.size} exports of ${pkg.version}`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
