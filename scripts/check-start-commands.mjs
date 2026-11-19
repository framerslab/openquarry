// CI only: runs the commands that start a project (scripts/start-commands.mjs, shown on the package page and in the
// README) for each starter, in a fresh folder outside this checkout, against the package from npm. Every file of the
// copied starter must validate, the package must be the newest one on npm, and the check must refuse a broken file.
//   node scripts/check-start-commands.mjs
// The documented commands copy the starter from the default branch. On a pull request START_REF holds the pull
// request's head commit and START_REPO the repository it comes from (a fork included), the copy is pinned to that
// commit with degit's #ref, and the job checks out the same commit, so the starters under review are the ones run and
// compared.
// The openquarry command's lines (npx openquarry init, check, new, id) are proven from the packed tarball by the cli job
// (scripts/check-cli.mjs). This job also runs them against npm, in a fresh folder with an empty npm cache, but only
// once the registry shows that the openquarry package there is ours (scripts/package-on-npm.mjs) and is the version
// this commit documents. A package of that name from anyone else stops the job, and nothing from it is run.
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { packageOnNpm } from './package-on-npm.mjs'
import { beforeRelease, checkCommand, idCommand, initCommands, newCommands, newId, startCommands, starters } from './start-commands.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ref = process.env.START_REF || ''
const from = (ref && process.env.START_REPO) || undefined
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

// Runs a shell command, prints what it wrote, and returns its exit status and output.
function sh(command, cwd, options = '-euo pipefail', env = {}) {
  const result = spawnSync('bash', [...options.split(' '), '-c', command], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env } })
  const output = `${result.stdout || ''}${result.stderr || ''}`
  console.log(`$ ${command.replaceAll('\n', '\n$ ')}\n${output.trimEnd()}\n(exit ${result.status})`)
  return { status: result.status, output }
}

// Every file under a folder, its path relative to the folder with / between the parts.
function walk(dir, skip = () => false, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (skip(entry.name)) return []
    return entry.isDirectory() ? walk(path, skip, base) : [relative(base, path).split(sep).join('/')]
  })
}

const latest = spawnSync('npm', ['view', '@framers/openquarry', 'version'], { encoding: 'utf8' }).stdout.trim()
if (!/^\d+\.\d+\.\d+/.test(latest)) throw Error(`npm view @framers/openquarry version gave ${JSON.stringify(latest)}`)
console.log(`@framers/openquarry ${latest} is the newest version on npm${ref ? `; starters pinned to ${from || 'this repository'}#${ref}` : ''}`)

for (const starter of starters) {
  const dir = mkdtempSync(join(tmpdir(), `openquarry-start-${starter.id}-`))
  try {
    console.log(`\n=== ${starter.title}: ${starter.folder}`)
    const run = sh(startCommands(starter, ref, from), dir)
    if (run.status !== 0) throw Error(`${starter.id}: the documented commands failed`)
    const project = join(dir, starter.dest)

    // Every OpenQuarry file that arrived has its ok line, and the check says all of them are valid.
    const files = walk(project, (name) => name === 'node_modules').filter((file) => /^fabric\.yaml$|^catalogue\.yaml$|^weaves\/.*(\.yaml|\.md)$/.test(file))
    if (files.length < 4) throw Error(`${starter.id}: expected a fabric.yaml, a weave, a loom and a thread; found ${files.join(', ')}`)
    for (const file of files) if (!run.output.split('\n').includes(`ok ${file}`)) throw Error(`${starter.id}: no ok line for ${file}`)
    if (!run.output.includes(`${files.length} files checked, all valid.`)) throw Error(`${starter.id}: the check did not report all ${files.length} files valid`)

    // A copy pinned to this commit is the starter in this checkout, byte for byte, plus what npm install wrote.
    if (ref) {
      const ours = walk(join(root, starter.folder)).sort()
      const copied = walk(project, (name) => name === 'node_modules').filter((file) => file !== 'package-lock.json').sort()
      if (ours.join('\n') !== copied.join('\n')) throw Error(`${starter.id}: the copy holds\n${copied.join('\n')}\nthe starter holds\n${ours.join('\n')}`)
      for (const file of ours) if (!readFileSync(join(root, starter.folder, file)).equals(readFileSync(join(project, file)))) throw Error(`${starter.id}: ${file} differs from the starter`)
    }

    // The package came from the npm registry, at its newest version.
    const lock = JSON.parse(readFileSync(join(project, 'package-lock.json'), 'utf8'))
    const entry = lock.packages['node_modules/@framers/openquarry']
    if (!entry?.resolved?.startsWith('https://registry.npmjs.org/')) throw Error(`${starter.id}: @framers/openquarry was not installed from npm: ${JSON.stringify(entry)}`)
    if (entry.version !== latest) throw Error(`${starter.id}: installed @framers/openquarry ${entry.version}; npm's newest is ${latest}. Update the starter's range.`)
    console.log(`ok ${starter.id}: @framers/openquarry ${entry.version} from ${entry.resolved}`)

    // The check refuses a broken file and names what is wrong.
    const thread = files.find((file) => file.endsWith('.md'))
    const threadPath = join(project, thread)
    const text = readFileSync(threadPath, 'utf8')
    const refuses = (what, expected) => {
      const result = sh('npm run check', project, '-uo pipefail')
      if (result.status !== 1) throw Error(`${starter.id}: npm run check exited ${result.status} for ${what}`)
      for (const line of expected) if (!result.output.split('\n').includes(line)) throw Error(`${starter.id}: for ${what}, no line ${JSON.stringify(line)}`)
      console.log(`ok ${starter.id}: the check refuses ${what}`)
    }
    writeFileSync(threadPath, text.replace(/^version: .*\n/m, ''))
    refuses('a thread without its version', [`not ok ${thread}`, "  / must have required property 'version'"])
    writeFileSync(threadPath, 'No frontmatter\n')
    refuses('a thread without frontmatter', [`not ok ${thread}`, '  / has no YAML frontmatter between two --- lines at the top'])
    writeFileSync(threadPath, text)
    // A file whose name starts with a dot is checked too; only folders that start with a dot are skipped.
    const hidden = thread.replace(/[^/]+\.md$/, '.draft.md')
    writeFileSync(join(project, hidden), 'No frontmatter\n')
    refuses('a hidden thread without frontmatter', [`not ok ${hidden}`, '  / has no YAML frontmatter between two --- lines at the top'])
    rmSync(join(project, hidden))

    // The next thread: a copy with the same id is refused; with the id the documented command prints, it passes.
    const next = thread.replace(/[^/]+\.md$/, 'next.md')
    copyFileSync(threadPath, join(project, next))
    refuses('two threads with one id', [`not ok ${next}`, `  /id is already the id of ${thread}: give this file its own id`])
    const id = sh(newId, project).output.trim()
    if (!uuid.test(id)) throw Error(`${starter.id}: ${newId} printed ${JSON.stringify(id)}`)
    const id0 = /^id: (.+)$/m.exec(text)[1]
    writeFileSync(join(project, next), text.replace(`id: ${id0}`, `id: ${id}`).replace(/^slug: .*$/m, 'slug: next'))
    const after = sh('npm run check', project)
    if (after.status !== 0 || !after.output.split('\n').includes(`ok ${next}`)) throw Error(`${starter.id}: the next thread with a new id did not pass`)
    console.log(`ok ${starter.id}: a new thread with its own id passes`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}
console.log('\nok every starter: copied, installed from npm and checked')

// The openquarry command, from npm. The same reading of the registry is first made of the library, which this
// repository's release workflow has published since 0.2.0: it must come back as ours, so the reading itself is proven
// on every run, before and after the command's first release.
const libraryOnNpm = await packageOnNpm('@framers/openquarry')
if (libraryOnNpm.version !== latest) throw Error(`The registry names @framers/openquarry ${libraryOnNpm.version} as newest; npm view said ${latest}`)
console.log(`\nok @framers/openquarry ${latest} on npm is ours: our maintainers, and provenance from this repository's release workflow`)
const command = JSON.parse(readFileSync(join(root, 'packages', 'openquarry', 'package.json'), 'utf8'))
const commandOnNpm = await packageOnNpm('openquarry')
if (commandOnNpm.version === undefined) {
  console.log(`openquarry is not on npm yet: its documented commands are proven from the packed tarball by the cli job (scripts/check-cli.mjs)`)
  if (!beforeRelease) throw Error('The docs no longer say that openquarry is not on npm yet, and npm has no such package: restore beforeRelease in scripts/start-commands.mjs until the release')
} else if (commandOnNpm.version !== command.version) {
  console.log(`npm serves openquarry ${commandOnNpm.version} (ours) and this commit documents ${command.version}: nothing was run from npm; the commands of this commit are proven from the packed tarball by the cli job`)
} else {
  // A person's first run: an empty folder, an empty npm cache, the documented lines as written.
  const dir = mkdtempSync(join(tmpdir(), 'openquarry-npx-'))
  const env = { npm_config_cache: join(dir, '.npm-cache'), npm_config_yes: 'true', npm_config_update_notifier: 'false' }
  try {
    for (const starter of starters) {
      console.log(`\n=== ${starter.title}: openquarry ${command.version} from npm`)
      const made = sh(initCommands(starter), dir, undefined, env)
      if (made.status !== 0 || !/^\d+ files checked, all valid\.$/m.test(made.output)) throw Error(`${starter.id}: the documented commands failed against openquarry ${command.version} from npm`)
      const added = sh(`${newCommands[starter.id]}\n${checkCommand}`, join(dir, starter.dest), undefined, env)
      if (added.status !== 0 || !/^\d+ files checked, all valid\.$/m.test(added.output)) throw Error(`${starter.id}: ${newCommands[starter.id]} did not leave a valid project`)
    }
    const id = sh(idCommand, dir, undefined, env).output.trim().split('\n').pop()
    if (!uuid.test(id)) throw Error(`${idCommand} printed ${JSON.stringify(id)}`)
    console.log(`\nok openquarry ${command.version} from npm: init, check, new and id as documented`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
  // The sentence that says the package is not on npm yet has done its work: a warning until it is removed.
  if (beforeRelease) console.log('::warning file=scripts/start-commands.mjs::openquarry is on npm: set beforeRelease to null and remove its sentence from the README')
}
