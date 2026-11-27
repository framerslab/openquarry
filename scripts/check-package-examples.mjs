// CI only: runs the package and landing page examples against this checkout packed as npm would publish it, and
// compares the output and exports with what the site shows.
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
const wrapperRoot = join(root, 'packages', 'openquarry')
const wrapper = JSON.parse(readFileSync(join(wrapperRoot, 'package.json'), 'utf8'))
const dir = mkdtempSync(join(tmpdir(), 'openquarry-examples-'))
const run = (command, args) => execFileSync(command, args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
// A failed command: its exit status and everything it wrote, so a CI log shows why.
const failure = (error) => `exit ${error.status}\n${error.stdout || ''}${error.stderr || ''}`

try {
  run('npm', ['pack', root, wrapperRoot, '--silent', '--pack-destination', dir])
  const specs = readdirSync(dir).filter((name) => name.endsWith('.tgz')).map((name) => join(dir, name))
  console.log(`Checking the examples against the packed ${wrapper.name}@${wrapper.version} and ${pkg.name}@${pkg.version}`)

  const typescript = String(pkg.devDependencies.typescript).replace(/^\^/, '')
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'openquarry-examples', private: true, type: 'module' }, null, 2))
  run('npm', ['install', '--no-audit', '--no-fund', ...specs, 'yaml', 'ajv', 'ajv-formats', `typescript@${typescript}`])
  for (const { name, version } of [pkg, wrapper]) {
    const installed = JSON.parse(readFileSync(join(dir, 'node_modules', name, 'package.json'), 'utf8')).version
    if (installed !== version) throw Error(`Installed ${name}@${installed}, expected ${version}`)
  }

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
  const exportNames = (name) => JSON.parse(run(process.execPath, ['--input-type=module', '-e', `console.log(JSON.stringify(Object.keys(await import(${JSON.stringify(name)}))))`]))
  const values = exportNames(pkg.name)
  if (JSON.stringify(exportNames(wrapper.name)) !== JSON.stringify(values)) throw Error('The wrapper and library export different names')
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
  console.log(`ok the package page lists all ${exported.size} exports of ${pkg.version}`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
