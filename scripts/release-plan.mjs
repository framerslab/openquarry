// The release workflow's plan: which of the two packages has a version in this commit that npm does not serve yet.
//   node scripts/release-plan.mjs          writes library, library_version, command and command_version to
//                                          $GITHUB_OUTPUT, and fails when neither version is new
//   node scripts/release-plan.mjs --wait   waits until npm serves the library's version in this commit (the command
//                                          depends on it), asking every 10 seconds for 5 minutes at most
// npm answers a version it never published with no output and a package it never saw with E404. Any other failure (the
// registry down, output that is not JSON) stops the release: an unknown is never read as "new".
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = (...path) => JSON.parse(readFileSync(join(root, ...path, 'package.json'), 'utf8'))
const library = manifest()
const command = manifest('packages', 'openquarry')

/** True when npm serves that exact version of the package. */
function served({ name, version }) {
  let answer = ''
  try {
    answer = execFileSync('npm', ['view', `${name}@${version}`, 'version', '--json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    const text = `${error.stdout || ''}${error.stderr || ''}`
    if (/\bE404\b/.test(text)) return false
    throw Error(`npm view ${name}@${version} failed: ${error.message}\n${text}`)
  }
  return answer.trim() !== '' && JSON.parse(answer) === version
}

if (process.argv.includes('--wait')) {
  for (let asked = 0; asked < 30; asked += 1) {
    if (served(library)) {
      console.log(`npm serves ${library.name}@${library.version}`)
      process.exit(0)
    }
    console.log(`npm does not serve ${library.name}@${library.version} yet`)
    await new Promise((resolve) => setTimeout(resolve, 10000))
  }
  throw Error(`npm did not serve ${library.name}@${library.version} within 5 minutes of its publish: openquarry depends on it and is not published`)
}

// The command's dependency must take the library version of this commit: the two are released as one line.
const [major, minor] = library.version.split('.')
const range = command.dependencies[library.name]
if (range !== `^${major}.${minor}.0` || !command.version.startsWith(`${major}.${minor}.`)) {
  throw Error(`openquarry ${command.version} depends on ${library.name} ${range}; the library here is ${library.version}`)
}
const plan = { library: !served(library), command: !served(command) }
console.log(`${library.name}@${library.version}: ${plan.library ? 'new, to publish' : 'on npm'}`)
console.log(`${command.name}@${command.version}: ${plan.command ? 'new, to publish' : 'on npm'}`)
if (!plan.library && !plan.command) throw Error('Nothing to release: npm serves both versions. Raise the version of the package that changed.')
const output = `library=${plan.library}\nlibrary_version=${library.version}\ncommand=${plan.command}\ncommand_version=${command.version}\n`
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output)
else console.log(output)
