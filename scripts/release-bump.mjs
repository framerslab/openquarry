// The daily release's first step: which package has shipped changes on master since its last release, and the
// version it is published under.
//   node scripts/release-bump.mjs   finds each package's last release by its tag (lib-v<version> for
//                                   @framers/openquarry, cli-v<version> for openquarry), lists the files of the
//                                   package that changed since that commit, and for each changed package writes the
//                                   version it takes into its package.json in this checkout only. Writes
//                                   release=true|false, library=true|false and command=true|false to $GITHUB_OUTPUT.
// The version is the next patch after the newest version npm serves, unless the repository's package.json holds a
// higher one (a minor or major raised by hand), which is taken as it is. Nothing is committed: npm and the tags record
// what was released. scripts/release-plan.mjs then checks the two versions against npm and against each other.
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** The two packages: the tag that marks a release, the folder of its package.json, and the files that ship in it or
 * build what ships (package.json `files`, the build inputs, and the starters the command bundles). */
export const packages = [
  { key: 'library', tag: 'lib-v', dir: '', paths: ['src', 'schema', 'docs', 'examples', 'README.md', 'CHANGELOG.md', 'LICENSE', 'package.json', 'tsconfig.json', 'tsup.config.ts'] },
  { key: 'command', tag: 'cli-v', dir: 'packages/openquarry', paths: ['packages/openquarry', 'templates'] },
]

/** Compares two x.y.z versions: negative, zero or positive. */
export function compareVersions(a, b) {
  const [x, y] = [a, b].map((v) => v.split('.').map(Number))
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] - y[i]
  return 0
}

/** The version a changed package is published under: the repository's when it is higher than npm's newest (raised by
 * hand), otherwise the next patch after npm's newest. A package npm never served takes the repository's version. */
export function nextVersion(repoVersion, npmLatest) {
  if (!npmLatest) return repoVersion
  if (compareVersions(repoVersion, npmLatest) > 0) return repoVersion
  const [major, minor, patch] = npmLatest.split('.').map(Number)
  return `${major}.${minor}.${patch + 1}`
}

/** The newest release tag with this prefix, by version, or null. Tags that are not <prefix>x.y.z are ignored. */
export function newestTag(tags, prefix) {
  const releases = tags
    .filter((tag) => tag.startsWith(prefix) && /^\d+\.\d+\.\d+$/.test(tag.slice(prefix.length)))
    .sort((a, b) => compareVersions(a.slice(prefix.length), b.slice(prefix.length)))
  return releases.at(-1) ?? null
}

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()

/** The version npm marks latest, or null for a package it never saw. Any other failure stops the release. */
function npmLatest(name) {
  try {
    return JSON.parse(execFileSync('npm', ['view', name, 'dist-tags.latest', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }))
  } catch (error) {
    const text = `${error.stdout || ''}${error.stderr || ''}`
    if (/\bE404\b/.test(text)) return null
    throw Error(`npm view ${name} failed: ${error.message}\n${text}`)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tags = git('tag', '--list').split('\n').filter(Boolean)
  const out = {}
  for (const p of packages) {
    const tag = newestTag(tags, p.tag)
    if (!tag) throw Error(`No ${p.tag}<version> tag: the commit of ${p.key}'s last release is unknown. Tag it, then run this again.`)
    const changed = git('diff', '--name-only', tag, 'HEAD', '--', ...p.paths).split('\n').filter(Boolean)
    out[p.key] = changed.length > 0
    const file = join(root, p.dir, 'package.json')
    const manifest = JSON.parse(readFileSync(file, 'utf8'))
    if (!out[p.key]) {
      console.log(`${manifest.name}: nothing it ships changed since ${tag}`)
      continue
    }
    const version = nextVersion(manifest.version, npmLatest(manifest.name))
    console.log(`${manifest.name}: ${changed.length} file(s) changed since ${tag} (${changed.slice(0, 5).join(', ')}${changed.length > 5 ? ', ...' : ''}); publishing ${version}`)
    manifest.version = version
    writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n')
  }
  const release = out.library || out.command
  if (!release) console.log('Nothing to release today.')
  const output = `release=${release}\nlibrary=${out.library}\ncommand=${out.command}\n`
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output)
  else console.log(output)
}
