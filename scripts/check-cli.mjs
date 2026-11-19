// CI only: the openquarry command, run from its packed tarball as a person gets it from npm.
//   node scripts/check-cli.mjs
// It packs packages/openquarry (npm pack, which bundles the starters), installs the tarball into an empty folder outside
// this checkout, and runs the documented commands (scripts/start-commands.mjs, shown in the README and on the package
// page): init for each starter, check, new note, new lesson and id. It holds what init wrote to the starters under
// templates/ byte for byte, breaks a file and reads the check's lines and exit code, and tries every refusal: a folder
// that is not empty, a file already there, a template name that is a path, and a link that leads out of the target.
// The library comes from npm at the version package.json names; while that version is not on npm yet, this build is
// packed and installed beside the command, as a release that carries both would publish them.
//   node scripts/check-cli.mjs --tarballs <folder>
// tests the tarballs already in that folder and packs nothing: the release publishes the exact files it tested.
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkCommand, idCommand, initCommands, newCommands, starters } from './start-commands.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const cliDir = join(root, 'packages', 'openquarry')
const cli = JSON.parse(readFileSync(join(cliDir, 'package.json'), 'utf8'))
const library = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const fail = (message) => { throw Error(message) }

// Runs a program, prints what it wrote, and returns its exit status and output.
function run(command, args, cwd, env = {}) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env }, timeout: 300000 })
  if (result.error) fail(`${command} ${args.join(' ')} did not finish: ${result.error.message}`)
  const stdout = result.stdout || ''
  const stderr = result.stderr || ''
  console.log(`$ ${[command, ...args].join(' ')}\n${`${stdout}${stderr}`.trimEnd()}\n(exit ${result.status})`)
  return { status: result.status, stdout, stderr, output: `${stdout}${stderr}`, lines: stdout.split('\n'), errors: stderr.split('\n') }
}
// A documented command, as a person types it in a shell.
const sh = (command, cwd) => run('bash', ['-euo', 'pipefail', '-c', command], cwd)

// Every file under a folder, its path relative to the folder with / between the parts. Links are listed, never followed.
function walk(dir, skip = () => false, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (skip(entry.name)) return []
    return entry.isDirectory() ? walk(path, skip, base) : [relative(base, path).split(sep).join('/')]
  }).sort()
}
const same = (a, b, what) => { if (JSON.stringify(a) !== JSON.stringify(b)) fail(`${what}:\n${JSON.stringify(a, null, 2)}\nexpected\n${JSON.stringify(b, null, 2)}`) }

const work = mkdtempSync(join(tmpdir(), 'openquarry-cli-'))
try {
  // 1. Pack the command (prepack bundles the starters into the package), or take the tarballs a release already packed.
  const given = process.argv.includes('--tarballs') ? resolve(process.argv[process.argv.indexOf('--tarballs') + 1] || fail('--tarballs needs a folder')) : ''
  const tarballs = given || join(work, 'tarballs')
  if (!given) {
    mkdirSync(tarballs)
    if (run('npm', ['pack', '--pack-destination', tarballs], cliDir).status !== 0) fail('npm pack failed for packages/openquarry')
  }
  const specs = [join(tarballs, `openquarry-${cli.version}.tgz`)]
  if (!existsSync(specs[0])) fail(`No ${specs[0]}: the folder holds ${readdirSync(tarballs).join(', ') || 'nothing'}`)

  // 2. The library: from npm when its version is there, otherwise this build: installed, built, then packed. npm answers
  // a version it never published with no output and a package it never saw with E404; any other failure stops the check.
  const libraryTarball = join(tarballs, `framers-openquarry-${library.version}.tgz`)
  const view = run('npm', ['view', `${library.name}@${library.version}`, 'version', '--json'], work)
  if (view.status !== 0 && !/\bE404\b/.test(view.output)) fail(`npm view ${library.name}@${library.version} failed`)
  const libraryOnNpm = (view.status === 0 && view.stdout.trim() ? JSON.parse(view.stdout) : '') === library.version
  if (existsSync(libraryTarball)) specs.push(libraryTarball)
  else if (libraryOnNpm) console.log(`${library.name}@${library.version} comes from npm`)
  else if (given) fail(`${library.name}@${library.version} is not on npm and ${tarballs} holds no tarball of it`)
  else {
    console.log(`${library.name}@${library.version} is not on npm yet: installing, building and packing this checkout`)
    for (const args of [['install', '--no-audit', '--no-fund'], ['run', 'build'], ['pack', '--pack-destination', tarballs]]) {
      if (run('npm', args, root).status !== 0) fail(`npm ${args.join(' ')} failed for the library`)
    }
    if (!existsSync(libraryTarball)) fail(`npm pack did not write ${libraryTarball}`)
    specs.push(libraryTarball)
  }

  // 3. Install into an empty folder.
  const home = join(work, 'home')
  mkdirSync(home)
  if (run('npm', ['install', '--no-audit', '--no-fund', ...specs], home).status !== 0) fail('npm install of the tarball failed')
  const installed = join(home, 'node_modules', 'openquarry')
  const bin = join(home, 'node_modules', '.bin', 'openquarry')
  // What a person types as "npx openquarry" inside a project. A project made by init has its own package.json, so npx
  // there would fetch the package from npm; the check runs the installed command's own bin in its place.
  const inProject = (command) => command.replaceAll('npx openquarry', JSON.stringify(bin))

  // The packed files: the bin, the modules, the re-export, the docs, the licence and both starters; nothing else.
  const packed = walk(installed, (name) => name === 'node_modules')
  const outside = packed.filter((file) => !/^(package\.json|README\.md|CHANGELOG\.md|LICENSE|index\.(js|cjs|d\.ts|d\.cts)|bin\/openquarry\.mjs|src\/[a-z-]+\.mjs|templates\/(notes|course)\/.+)$/.test(file))
  if (outside.length) fail(`The package ships files it should not: ${outside.join(', ')}`)
  for (const file of ['package.json', 'README.md', 'CHANGELOG.md', 'LICENSE', 'index.js', 'index.cjs', 'index.d.ts', 'index.d.cts', 'bin/openquarry.mjs', 'src/cli.mjs']) {
    if (!packed.includes(file)) fail(`The package lacks ${file}`)
  }
  if (!readFileSync(join(installed, 'LICENSE')).equals(readFileSync(join(root, 'LICENSE')))) fail('The package LICENSE is not the repository LICENSE')
  if (!readFileSync(join(installed, 'bin', 'openquarry.mjs'), 'utf8').startsWith('#!/usr/bin/env node\n')) fail('The bin does not start with #!/usr/bin/env node')
  const manifest = JSON.parse(readFileSync(join(installed, 'package.json'), 'utf8'))
  same([manifest.name, manifest.version, manifest.license, manifest.bin], ['openquarry', cli.version, 'MIT', { openquarry: 'bin/openquarry.mjs' }], 'the packed manifest')
  // The command reaches no network and starts no process: its modules import the file system, paths, crypto, the YAML
  // parser and the library, nothing more.
  for (const file of packed.filter((name) => /^(bin|src)\//.test(name))) {
    const text = readFileSync(join(installed, file), 'utf8')
    const imports = [...text.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g)].map((m) => m[1])
    const refused = imports.filter((name) => !/^(node:(fs|path|crypto|url|process)|yaml|@framers\/openquarry|\.{1,2}\/[a-z./-]+\.mjs)$/.test(name))
    if (refused.length) fail(`${file} imports ${refused.join(', ')}`)
    if (/\bfetch\s*\(|\beval\s*\(|new Function\b/.test(text)) fail(`${file} calls fetch, eval or new Function`)
  }
  // Which library the installed command resolved, and from where.
  const locked = JSON.parse(readFileSync(join(home, 'package-lock.json'), 'utf8')).packages['node_modules/@framers/openquarry']
  if (locked?.version !== library.version) fail(`The command resolved ${library.name} ${locked?.version}; this checkout holds ${library.version}`)
  if (specs.length === 1 && !String(locked.resolved).startsWith('https://registry.npmjs.org/')) fail(`${library.name} did not come from npm: ${locked.resolved}`)
  console.log(`ok installed openquarry ${manifest.version} with ${library.name} ${locked.version} from ${locked.resolved}`)

  // 4. Version, help, and a wrong command line.
  const version = run('npx', ['openquarry', '--version'], home)
  if (version.status !== 0 || version.stdout.trim() !== cli.version) fail(`--version printed ${JSON.stringify(version.stdout)}`)
  const help = run('npx', ['openquarry', '--help'], home)
  if (help.status !== 0) fail('--help did not exit with 0')
  for (const word of ['openquarry init [folder] [--template notes|course] [--force]', 'openquarry new note|lesson <title> [--in <folder>] [--slug <slug>]', 'openquarry check [folder]', 'openquarry id']) {
    if (!help.stdout.includes(word)) fail(`--help does not show: ${word}`)
  }
  same(run(bin, [], home).stdout, help.stdout, 'no command prints the help')
  const usage = (args, line, cwd = home) => {
    const result = run(bin, args, cwd)
    if (result.status !== 2) fail(`openquarry ${args.join(' ')} exited ${result.status}, expected 2`)
    if (result.stdout !== '') fail(`openquarry ${args.join(' ')} wrote to standard output: ${result.stdout}`)
    same(result.errors.slice(0, 3), [line, 'Run openquarry --help for the commands.', ''], `the error lines of openquarry ${args.join(' ')}`)
  }
  usage(['publish'], 'openquarry: no command named "publish"')
  usage(['check', '--json'], 'openquarry check: no option named --json')
  usage(['check', 'a', 'b'], 'openquarry check: one folder at most, got 2')
  usage(['id', 'now'], 'openquarry id: takes no argument')
  usage(['new', 'page', 'A title'], 'openquarry new: say note or lesson, not "page"')
  usage(['new', 'note'], 'openquarry new: a title is missing: openquarry new note "A title"')
  usage(['init', '--template'], 'openquarry init: --template needs a value')

  // A refusal: exit 1, one line on standard error, nothing on standard output.
  const refuses = (args, cwd, line) => {
    const result = run(bin, args, cwd)
    if (result.status !== 1) fail(`openquarry ${args.join(' ')} exited ${result.status}, expected 1`)
    if (result.stdout !== '') fail(`openquarry ${args.join(' ')} wrote to standard output: ${result.stdout}`)
    same(result.errors.slice(0, 2), [line, ''], `the error line of openquarry ${args.join(' ')}`)
  }

  // 5. to 8. Each starter.
  for (const starter of starters) {
    console.log(`\n=== ${starter.title}: ${starter.folder}`)
    const ours = walk(join(root, starter.folder))
    const project = join(home, starter.dest)
    const [first, ...rest] = initCommands(starter).split('\n')

    // The documented first line, with npx, from the folder that holds the install.
    const init = sh(first, home)
    if (init.status !== 0) fail(`${starter.id}: ${first} failed`)
    same(init.lines.filter((line) => line.startsWith('wrote ')), ours.map((file) => `wrote ${starter.dest}/${file}`), `${starter.id}: the wrote lines`)
    for (const line of [`Started ${starter.dest} from the ${starter.id} template: ${ours.length} files.`, `  cd ${starter.dest}`, '  npx openquarry check']) {
      if (!init.lines.includes(line)) fail(`${starter.id}: init did not print ${JSON.stringify(line)}`)
    }
    // What init wrote is the starter in this checkout, byte for byte, .gitignore included.
    same(walk(project), ours, `${starter.id}: the files init wrote`)
    for (const file of ours) {
      if (lstatSync(join(project, file)).isSymbolicLink()) fail(`${starter.id}: ${file} is a link`)
      if (!readFileSync(join(root, starter.folder, file)).equals(readFileSync(join(project, file)))) fail(`${starter.id}: ${file} differs from the starter`)
    }

    // check passes: with npx and the folder's name, and with the rest of the documented lines inside the project.
    const files = ours.filter((file) => /^fabric\.yaml$|^catalogue\.yaml$|^weaves\/.*(\.yaml|\.md)$/.test(file))
    const passes = (result, count, what) => {
      if (result.status !== 0) fail(`${starter.id}: the check failed ${what}`)
      if (!result.lines.includes(`${count} files checked, all valid.`)) fail(`${starter.id}: the check did not report ${count} files valid ${what}`)
    }
    const named = sh(`${checkCommand} ${starter.dest}`, home)
    passes(named, files.length, 'with the folder named')
    for (const file of files) if (!named.lines.includes(`ok ${file}`)) fail(`${starter.id}: no ok line for ${file}`)
    passes(sh(inProject(rest.join('\n')), home), files.length, 'inside the project')

    // The check refuses a broken file, names it and what is wrong, and exits with 1. On plain files its report is the
    // starter's own check.mjs line for line (the script reaches yaml and the library in the install above the project).
    const thread = files.find((file) => file.endsWith('.md'))
    const loom = dirname(thread)
    const threadPath = join(project, thread)
    const text = readFileSync(threadPath, 'utf8')
    const report = (what, status, expected) => {
      const result = run(bin, ['check'], project)
      const starters = run('node', ['check.mjs'], project)
      if (result.status !== status) fail(`${starter.id}: check exited ${result.status} for ${what}, expected ${status}`)
      for (const line of expected) if (!result.lines.includes(line)) fail(`${starter.id}: for ${what}, no line ${JSON.stringify(line)}`)
      same([result.status, result.stdout], [starters.status, starters.stdout], `${starter.id}: the command's report and check.mjs's for ${what}`)
      if (result.stderr !== '') fail(`${starter.id}: check wrote to standard error for ${what}: ${result.stderr}`)
      console.log(`ok ${starter.id}: the check reports ${what} as check.mjs does`)
    }
    const invalid = (count) => `1 of ${count} files invalid.`
    report('the starter as it is', 0, [`${files.length} files checked, all valid.`])
    writeFileSync(threadPath, text.replace(/^version: .*\n/m, ''))
    report('a thread without its version', 1, [`not ok ${thread}`, "  / must have required property 'version'", invalid(files.length)])
    writeFileSync(threadPath, text.replace(/^contentType: .*$/m, 'contentType: lecture'))
    report('a contentType the schema does not list', 1, [`not ok ${thread}`, '  /contentType must be equal to one of the allowed values: "lesson", "reference", "exercise", "assessment", "project", "discussion", "resource", "markdown", "code", "data", "media"', invalid(files.length)])
    writeFileSync(threadPath, 'No frontmatter\n')
    report('a thread without frontmatter', 1, [`not ok ${thread}`, '  / has no YAML frontmatter between two --- lines at the top', invalid(files.length)])
    writeFileSync(threadPath, '---\ninvalid: [\n---\n')
    report('YAML that cannot be read', 1, [`not ok ${thread}`, invalid(files.length)])
    writeFileSync(threadPath, text.replaceAll('\n', '\r\n'))
    report('CRLF line ends', 0, [`ok ${thread}`])
    writeFileSync(threadPath, `﻿${text}`)
    report('a byte-order mark', 0, [`ok ${thread}`])
    writeFileSync(threadPath, text)
    // A file whose name starts with a dot is checked; only folders that start with a dot, and node_modules, are skipped.
    const hidden = `${loom}/.draft.md`
    writeFileSync(join(project, hidden), 'No frontmatter\n')
    report('a hidden thread without frontmatter', 1, [`not ok ${hidden}`, '  / has no YAML frontmatter between two --- lines at the top', invalid(files.length + 1)])
    rmSync(join(project, hidden))
    for (const folder of ['.drafts', 'node_modules']) {
      mkdirSync(join(project, loom, folder))
      writeFileSync(join(project, loom, folder, 'skipped.md'), 'No frontmatter\n')
    }
    report('a dot folder and node_modules beside the threads', 0, [`${files.length} files checked, all valid.`])
    // Two threads with one id.
    const copy = `${loom}/second.md`
    copyFileSync(threadPath, join(project, copy))
    report('two threads with one id', 1, [`not ok ${copy}`, `  /id is already the id of ${thread}: give this file its own id`, invalid(files.length + 1)])
    rmSync(join(project, copy))
    // A pipe named like a thread is never opened (check.mjs would wait on it for ever): the command names it and goes on.
    const pipe = `${loom}/pipe.md`
    if (run('mkfifo', [join(project, pipe)], project).status !== 0) fail('mkfifo failed')
    {
      const result = run(bin, ['check'], project)
      if (result.status !== 1) fail(`${starter.id}: check exited ${result.status} for a pipe`)
      for (const line of [`not ok ${pipe}`, '  / is not a plain file', invalid(files.length + 1)]) if (!result.lines.includes(line)) fail(`${starter.id}: for a pipe, no line ${JSON.stringify(line)}`)
    }
    rmSync(join(project, pipe))

    // 7. new: the documented line, inside the project.
    const kind = starter.id === 'course' ? 'lesson' : 'note'
    const added = sh(inProject(newCommands[starter.id]), project)
    const title = /"(.+?)"/.exec(newCommands[starter.id])[1]
    const slug = title.toLowerCase().replaceAll(' ', '-')
    const made = `${loom}/${slug}.md`
    if (added.status !== 0) fail(`${starter.id}: ${newCommands[starter.id]} failed`)
    same(added.lines, [`wrote ${made}`, ''], `${starter.id}: what new printed`)
    const block = (file) => /^---\n([\s\S]*?)\n---\n\n# (.*)\n$/.exec(readFileSync(join(project, file), 'utf8')) ?? fail(`${starter.id}: ${file} is not a block and a heading`)
    const keys = (file) => block(file)[1].split('\n').map((line) => line.slice(0, line.indexOf(':')))
    const value = (file, key) => new RegExp(`^${key}: (.*)$`, 'm').exec(block(file)[1])[1]
    same(keys(made), ['id', 'slug', 'title', 'version', 'contentType'], `${starter.id}: the keys of the new ${kind}`)
    same([value(made, 'slug'), value(made, 'title'), value(made, 'version'), value(made, 'contentType'), block(made)[2]], [slug, title, '1.0.0', kind === 'lesson' ? 'lesson' : 'markdown', title], `${starter.id}: the new ${kind}`)
    if (!uuid.test(value(made, 'id'))) fail(`${starter.id}: the new ${kind}'s id is ${value(made, 'id')}`)
    // No licence is written into a person's own file: not the schema's default, not any other.
    if (/licen[sc]e|publishing/i.test(readFileSync(join(project, made), 'utf8'))) fail(`${starter.id}: the new ${kind} holds a licence line`)
    // The same title again: refused, and the file is left as it was.
    const before = readFileSync(join(project, made))
    refuses(['new', kind, title, '--in', loom], project, `openquarry new: ${made} is already there: nothing written. Pass --slug for another file name.`)
    if (!before.equals(readFileSync(join(project, made)))) fail(`${starter.id}: a refused new changed ${made}`)
    // The other kind, with --in=, from the folder itself, and titles a slug and YAML must survive.
    const other = kind === 'lesson' ? 'note' : 'lesson'
    const here = join(project, loom)
    same(run(bin, ['new', other, 'Check your work', `--in=${loom}/`], project).lines, [`wrote ${loom}/check-your-work.md`, ''], `${starter.id}: new ${other} with --in=`)
    same(value(`${loom}/check-your-work.md`, 'contentType'), other === 'lesson' ? 'lesson' : 'markdown', `${starter.id}: the contentType of a ${other}`)
    const long = `A long title ${'that goes on '.repeat(12)}to the end`
    const titles = [
      [['C++ & Rust: a "tour" #1!'], 'c-rust-a-tour-1', 'C++ & Rust: a "tour" #1!'],
      [['  Überblick für Anfänger  '], 'uberblick-fur-anfanger', 'Überblick für Anfänger'],
      [['--', '--not-an-option'], 'not-an-option', '--not-an-option'],
      [[long, '--slug', 'a-long-title'], 'a-long-title', long],
      [['日本語', '--slug', 'nihongo'], 'nihongo', '日本語'],
      // Titles a careless writer of YAML would change: a word YAML reads as a boolean, a comment sign, a mapping, a number.
      [['true'], 'true', 'true'],
      [['Title # draft'], 'title-draft', 'Title # draft'],
      [['a: b'], 'a-b', 'a: b'],
      [['2026'], '2026', '2026'],
      [["It's \\ a 'test'"], 'it-s-a-test', "It's \\ a 'test'"],
    ]
    for (const [args, name] of titles) same(run(bin, ['new', kind, ...args], here).lines, [`wrote ${name}.md`, ''], `${starter.id}: new ${kind} ${JSON.stringify(args)}`)
    usage(['new', kind, '日本語'], 'openquarry new: no slug can be made from the title "日本語": pass --slug with lowercase letters, digits and hyphens', here)
    usage(['new', kind, 'A title', '--slug', 'Not_A_Slug'], 'openquarry new: --slug takes lowercase letters, digits and hyphens, with a letter or a digit: got "Not_A_Slug"', here)
    usage(['new', kind, 'A title', '--slug', '---'], 'openquarry new: --slug takes lowercase letters, digits and hyphens, with a letter or a digit: got "---"', here)
    usage(['new', kind, 'Two\nlines'], 'openquarry new: the title must be one line with no control character', here)
    usage(['new', kind, '   '], 'openquarry new: a title is missing: openquarry new note "A title"', here)
    usage(['new', kind, 'Two', 'titles'], 'openquarry new: one title, in quotes when it has spaces: got 2', here)
    // The titles come back from the YAML as they went in, as text, with the five keys and nothing more; every id is its own.
    const parsed = run('node', ['--input-type=module', '-e', `
      import { readFileSync, readdirSync } from 'node:fs'
      import { parse } from 'yaml'
      const out = {}
      for (const name of readdirSync('.').filter((n) => n.endsWith('.md')).sort()) {
        const data = parse(/^---\\n([\\s\\S]*?)\\n---\\n/.exec(readFileSync(name, 'utf8'))[1])
        out[name] = [data.title, data.id, Object.keys(data), Object.values(data).map((v) => typeof v), readFileSync(name, 'utf8').split('\\n').pop() === '' && readFileSync(name, 'utf8').split('\\n').at(-2)]
      }
      console.log(JSON.stringify(out))`], here)
    const read = JSON.parse(parsed.stdout)
    for (const [, name, expected] of titles) {
      const [got, , names, types, heading] = read[`${name}.md`] ?? fail(`${starter.id}: no ${name}.md`)
      same([got, names, types, heading], [expected, ['id', 'slug', 'title', 'version', 'contentType'], ['string', 'string', 'string', 'string', 'string'], `# ${expected}`], `${starter.id}: ${name}.md read back`)
    }
    const ids = Object.values(read).map(([, id]) => id)
    if (new Set(ids).size !== ids.length || ids.length !== titles.length + 3) fail(`${starter.id}: ${ids.length} threads hold ${new Set(ids).size} ids`)
    // A folder outside weaves/, the weaves/ folder itself, and a folder that is not there.
    const outsideWeaves = 'is not inside a weaves/ folder, where openquarry check looks for notes and lessons: name a folder with --in, such as --in weaves/notes/getting-started'
    refuses(['new', kind, 'A title'], project, `openquarry new: this folder ${outsideWeaves}`)
    refuses(['new', kind, 'A title', '--in', 'weaves'], project, `openquarry new: weaves ${outsideWeaves}`)
    refuses(['new', kind, 'A title', '--in', `${loom}/nowhere`], project, `openquarry new: ${loom}/nowhere is not a folder: make it first`)
    refuses(['new', kind, 'A title', '--in', thread], project, `openquarry new: ${thread} is a file, not a folder`)
    // A folder the check skips, and a link (the check follows none, and a link can lead out of the project).
    for (const folder of ['.drafts', 'node_modules']) {
      refuses(['new', kind, 'A title', '--in', `${loom}/${folder}`], project, `openquarry new: ${loom}/${folder} is in a folder openquarry check skips (${folder}): nothing written`)
      rmSync(join(project, loom, folder), { recursive: true })
    }
    const away = join(work, `away-${starter.id}`)
    mkdirSync(join(away, 'deeper'), { recursive: true })
    symlinkSync(away, join(project, loom, 'linked'))
    refuses(['new', kind, 'A title', '--in', `${loom}/linked`], project, `openquarry new: ${loom}/linked is a link, and openquarry check follows no link below weaves/: nothing written`)
    refuses(['new', kind, 'A title', '--in', `${loom}/linked/deeper`], project, `openquarry new: ${loom}/linked is a link, and openquarry check follows no link below weaves/: nothing written`)
    same(walk(away), [], `${starter.id}: the folder a link leads to`)
    rmSync(join(project, loom, 'linked'))
    report('the project after new', 0, [`${files.length + titles.length + 2} files checked, all valid.`])
    console.log(`ok ${starter.id}: new writes a valid ${kind} with its own id and no licence`)
  }

  // 8. init: what it refuses, and what --force does.
  console.log('\n=== init: refusals')
  const notes = starters.find((starter) => starter.id === 'notes')
  const ours = walk(join(root, notes.folder))
  // A folder that is not empty: refused, and left as it was.
  const full = join(home, 'full')
  mkdirSync(full)
  writeFileSync(join(full, 'README.md'), 'Mine.\n')
  refuses(['init', 'full'], home, 'openquarry init: full is not empty: nothing written. Pass --force to add the files that are missing; no file is ever overwritten.')
  same(walk(full), ['README.md'], 'a refused folder')
  refuses(['init'], full, 'openquarry init: this folder is not empty: nothing written. Pass --force to add the files that are missing; no file is ever overwritten.')
  // --force: the missing files are written, the one that is there is kept as it is.
  const forced = run(bin, ['init', 'full', '--force'], home)
  if (forced.status !== 0) fail('init --force failed')
  same(forced.lines.filter((line) => /^(wrote|kept) /.test(line)), ours.map((file) => (file === 'README.md' ? 'kept full/README.md (already there)' : `wrote full/${file}`)), 'the lines of init --force')
  if (!forced.lines.includes(`Started full from the notes template: ${ours.length - 1} files written, 1 kept.`)) fail('init --force did not print its count')
  same(walk(full), ours, 'the files after init --force')
  if (readFileSync(join(full, 'README.md'), 'utf8') !== 'Mine.\n') fail('init --force overwrote README.md')
  for (const file of ours.filter((name) => name !== 'README.md')) if (!readFileSync(join(root, notes.folder, file)).equals(readFileSync(join(full, file)))) fail(`init --force: ${file} differs from the starter`)
  // A folder that holds only .git is empty; with no folder named, init writes into the current one.
  const repo = join(home, 'repo')
  mkdirSync(join(repo, '.git'), { recursive: true })
  writeFileSync(join(repo, '.git', 'HEAD'), 'ref: refs/heads/master\n')
  const inside = run(bin, ['init', '--template=course'], repo)
  const course = walk(join(root, 'templates', 'course'))
  if (inside.status !== 0) fail('init in a folder that holds only .git failed')
  same(inside.lines.filter((line) => line.startsWith('wrote ')), course.map((file) => `wrote ${file}`), 'the lines of init in the current folder')
  if (inside.lines.some((line) => line.trim().startsWith('cd '))) fail('init in the current folder printed a cd line')
  same(walk(repo, (name) => name === '.git'), course, 'the files of init in the current folder')
  // A new folder inside folders that do not exist yet is made.
  if (run(bin, ['init', 'deep/down/notes'], home).status !== 0 || !existsSync(join(home, 'deep', 'down', 'notes', 'fabric.yaml'))) fail('init did not make a nested folder')
  // The target is a file.
  writeFileSync(join(home, 'a-file'), 'x\n')
  refuses(['init', 'a-file'], home, 'openquarry init: a-file is a file, not a folder: nothing written')
  // A template name is one of the bundled names, never a path.
  for (const name of ['../notes', '/etc', 'templates/notes', 'nope', '']) {
    usage(['init', 'escape', '--template', name], `openquarry init: no template named ${JSON.stringify(name)}: the templates are notes, course`)
    if (existsSync(join(home, 'escape'))) fail(`init made a folder for the template ${JSON.stringify(name)}`)
  }
  usage(['init', 'a', 'b'], 'openquarry init: one folder at most, got 2')
  // A link in the target that leads out of it: refused before any write, with --force too, and nothing lands outside.
  const outsideDir = join(work, 'outside')
  mkdirSync(outsideDir)
  const linked = join(home, 'linked')
  mkdirSync(linked)
  symlinkSync(outsideDir, join(linked, 'weaves'))
  refuses(['init', 'linked', '--force'], home, 'openquarry init: linked/weaves is a link, not a folder: nothing written, so no file lands outside linked')
  same([walk(outsideDir), readdirSync(linked)], [[], ['weaves']], 'a target with a link that leads out')
  // A file where a folder of the template goes.
  const blocked = join(home, 'blocked')
  mkdirSync(blocked)
  writeFileSync(join(blocked, 'weaves'), 'x\n')
  refuses(['init', 'blocked', '--force'], home, 'openquarry init: blocked/weaves is a file, not a folder: nothing written')
  same(readdirSync(blocked), ['weaves'], 'a target with a file where a folder goes')
  // A dangling link where a file of the template goes is kept, never written through.
  const dangling = join(home, 'dangling')
  mkdirSync(dangling)
  symlinkSync(join(outsideDir, 'fabric.yaml'), join(dangling, 'fabric.yaml'))
  const kept = run(bin, ['init', 'dangling', '--force'], home)
  if (kept.status !== 0 || !kept.lines.includes('kept dangling/fabric.yaml (already there)')) fail('init --force did not keep a dangling link')
  same(walk(outsideDir), [], 'a dangling link in the target')
  // A link planted in the installed template: the command copies plain files only and stops before any write.
  const planted = join(installed, 'templates', 'notes', 'weaves', 'planted')
  symlinkSync(outsideDir, planted)
  refuses(['init', 'from-planted'], home, 'openquarry init: the notes template holds weaves/planted, which is not a plain file or a folder: nothing written')
  if (existsSync(join(home, 'from-planted'))) fail('init made a folder from a template that holds a link')
  rmSync(planted)
  const secret = join(work, 'secret.txt')
  writeFileSync(secret, 'outside the template\n')
  symlinkSync(secret, join(installed, 'templates', 'notes', 'stolen.txt'))
  refuses(['init', 'from-planted'], home, 'openquarry init: the notes template holds stolen.txt, which is not a plain file or a folder: nothing written')
  if (existsSync(join(home, 'from-planted'))) fail('init made a folder from a template that holds a link to a file')
  rmSync(join(installed, 'templates', 'notes', 'stolen.txt'))
  // A path that leaves the target once its stored name is decoded (_dot_. is ..), and a path into .git.
  const dotdot = join(installed, 'templates', 'notes', '_dot_.')
  mkdirSync(dotdot)
  writeFileSync(join(dotdot, 'escaped.md'), 'outside\n')
  refuses(['init', 'from-planted'], home, 'openquarry init: the notes template holds ../escaped.md, a path that leaves the folder: nothing written')
  if (existsSync(join(home, 'from-planted')) || existsSync(join(home, 'escaped.md'))) fail('init wrote a path that leaves the target')
  rmSync(dotdot, { recursive: true })
  const dotgit = join(installed, 'templates', 'notes', '_dot_git')
  mkdirSync(join(dotgit, 'hooks'), { recursive: true })
  writeFileSync(join(dotgit, 'hooks', 'pre-commit'), '#!/bin/sh\n')
  refuses(['init', 'from-planted'], home, 'openquarry init: the notes template holds .git/hooks/pre-commit, and a template never writes into .git: nothing written')
  refuses(['init', '--force'], repo, 'openquarry init: the notes template holds .git/hooks/pre-commit, and a template never writes into .git: nothing written')
  if (existsSync(join(home, 'from-planted')) || existsSync(join(repo, '.git', 'hooks'))) fail('init wrote into .git')
  rmSync(dotgit, { recursive: true })
  console.log('ok init refuses a folder that is not empty, a template name that is a path, and every path and link that leads out')

  // 12. No code from a template runs: lifecycle scripts and a check.mjs that would each leave a marker leave none.
  const marker = join(work, 'marker')
  const leaves = `require('fs').writeFileSync(${JSON.stringify(marker)}, 'ran')`
  const hostile = { name: 'hostile', private: true, scripts: Object.fromEntries(['preinstall', 'install', 'postinstall', 'prepare', 'prepack', 'check'].map((name) => [name, `node -e ${JSON.stringify(leaves)}`])) }
  writeFileSync(join(installed, 'templates', 'notes', 'package.json'), JSON.stringify(hostile))
  writeFileSync(join(installed, 'templates', 'notes', 'check.mjs'), `import { writeFileSync } from 'node:fs'\nwriteFileSync(${JSON.stringify(marker)}, 'ran')\n`)
  if (run(bin, ['init', 'hostile'], home).status !== 0 || run(bin, ['check', 'hostile'], home).status !== 0) fail('init and check of a template with scripts failed')
  same(JSON.parse(readFileSync(join(home, 'hostile', 'package.json'), 'utf8')), hostile, 'the copied package.json')
  if (existsSync(marker)) fail('init or check ran code from the template')
  // The marker works: the template's own script leaves it when a person runs it.
  if (run('node', ['check.mjs'], join(home, 'hostile')).status !== 0 || !existsSync(marker)) fail('the marker script does not leave its marker')
  rmSync(marker)
  for (const file of ['package.json', 'check.mjs']) copyFileSync(join(root, notes.folder, file), join(installed, 'templates', 'notes', file))

  // 13. No network and no other process: every command runs again with those APIs replaced by ones that fail and
  // leave a marker.
  const deny = join(work, 'deny.cjs')
  writeFileSync(deny, `
    const fs = require('node:fs')
    const hit = (what) => function () { fs.appendFileSync(${JSON.stringify(marker)}, what + '\\n'); throw new Error('blocked: ' + what) }
    const net = require('node:net')
    net.Socket.prototype.connect = hit('net.Socket.connect')
    for (const name of ['connect', 'createConnection']) net[name] = hit('net.' + name)
    const dns = require('node:dns')
    for (const name of ['lookup', 'resolve', 'resolve4', 'resolve6']) { dns[name] = hit('dns.' + name); dns.promises[name] = hit('dns.promises.' + name) }
    for (const name of ['node:http', 'node:https']) for (const call of ['request', 'get']) require(name)[call] = hit(name + '.' + call)
    const child = require('node:child_process')
    for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) child[name] = hit('child_process.' + name)
    globalThis.fetch = hit('fetch')
    require('node:module').syncBuiltinESMExports()
  `)
  const sealed = (args, cwd) => run('node', ['--require', deny, join(installed, 'bin', 'openquarry.mjs'), ...args], cwd)
  // The seal works: a fetch and a spawn under it each fail and leave the marker.
  const control = run('node', ['--require', deny, '--input-type=module', '-e', "import { spawnSync } from 'node:child_process'; try { spawnSync('true') } catch {} ; try { fetch('http://127.0.0.1:9/') } catch {}"], home)
  same(existsSync(marker) && readFileSync(marker, 'utf8'), 'child_process.spawnSync\nfetch\n', `the seal's own marker (exit ${control.status})`)
  rmSync(marker)
  for (const [args, cwd] of [[['init', 'sealed'], home], [['init', 'sealed-course', '--template', 'course'], home], [['check', 'sealed'], home], [['new', 'note', 'Sealed note', '--in', 'weaves/notes/getting-started'], join(home, 'sealed')], [['new', 'lesson', 'Sealed lesson', '--in', 'weaves/my-course/first-unit'], join(home, 'sealed-course')], [['check'], join(home, 'sealed-course')], [['id'], home], [['--help'], home], [['--version'], home]]) {
    if (sealed(args, cwd).status !== 0) fail(`openquarry ${args.join(' ')} failed with the network and process APIs sealed`)
  }
  if (existsSync(marker)) fail(`a command reached for the network or another process: ${readFileSync(marker, 'utf8')}`)
  same(walk(join(home, 'sealed')).filter((file) => file !== 'weaves/notes/getting-started/sealed-note.md'), ours, 'the files of a sealed init')
  console.log('ok no command reaches the network or starts a process, and no code from a template runs')

  // check: a folder with no OpenQuarry files, and a folder that is not there.
  const empty = join(home, 'empty')
  mkdirSync(empty)
  const none = run(bin, ['check', 'empty'], home)
  if (none.status !== 1 || !none.lines.includes('No OpenQuarry files found: expected fabric.yaml or a weaves/ folder here.')) fail('check of an empty folder did not say so')
  refuses(['check', 'not-there'], home, 'openquarry check: not-there is not a folder')

  // 9. id: the documented line prints a UUID, a new one each time.
  const one = sh(idCommand, home).stdout
  const two = run(bin, ['id'], home).stdout
  if (!uuid.test(one.trim()) || !uuid.test(two.trim()) || one === two || !one.endsWith('\n')) fail(`id printed ${JSON.stringify([one, two])}`)

  // 10. The package re-exports the library, as an ES module and from CommonJS.
  const require = createRequire(join(home, 'index.cjs'))
  const fromLibrary = Object.keys(require('@framers/openquarry')).sort()
  same(Object.keys(require('openquarry')).sort(), fromLibrary, 'require("openquarry")')
  const esm = run('node', ['--input-type=module', '-e', "import * as a from 'openquarry'; import * as b from '@framers/openquarry'; console.log(JSON.stringify([Object.keys(a).sort(), Object.keys(b).sort(), a.validateWeave === b.validateWeave, a.validateWeave({ slug: 'a', title: 'Abc' })]))"], home)
  const [a, b, sameFunction, result] = JSON.parse(esm.stdout)
  same([a, b, sameFunction, result], [fromLibrary, fromLibrary, true, { valid: true, errors: [] }], 'import("openquarry")')
  if (fromLibrary.length < 10) fail(`The library exports ${fromLibrary.length} names`)
  for (const file of ['index.d.ts', 'index.d.cts']) same(readFileSync(join(installed, file), 'utf8'), "export * from '@framers/openquarry'\n", file)
  // Its types reach a TypeScript project both ways: an ES module and a CommonJS file each import a validator and a type.
  const typescript = String(library.devDependencies.typescript).replace(/^\^/, '')
  if (run('npm', ['install', '--no-audit', '--no-fund', '--no-save', `typescript@${typescript}`], home).status !== 0) fail('npm install typescript failed')
  writeFileSync(join(home, 'consumer.mts'), "import { validateThreadFrontmatter, type ThreadFrontmatter, type ValidationResult } from 'openquarry'\nconst data: Partial<ThreadFrontmatter> = { slug: 'a' }\nconst result: ValidationResult = validateThreadFrontmatter(data)\nexport const valid: boolean = result.valid\n")
  writeFileSync(join(home, 'consumer.cts'), "import openquarry = require('openquarry')\nconst weave: openquarry.Weave = { slug: 'a', title: 'Abc' }\nconst result: openquarry.ValidationResult = openquarry.validateWeave(weave)\nexport = result.valid\n")
  const tsc = ['tsc', '--noEmit', '--strict', '--module', 'nodenext', '--moduleResolution', 'nodenext', '--skipLibCheck']
  if (run('npx', [...tsc, 'consumer.mts', 'consumer.cts'], home).status !== 0) fail('The types of openquarry did not compile for an ES module and a CommonJS consumer')
  // The compile can fail: a name the library does not export is refused.
  writeFileSync(join(home, 'wrong.mts'), "import { validateEverything } from 'openquarry'\nexport const x = validateEverything\n")
  if (!run('npx', [...tsc, 'wrong.mts'], home).output.includes('validateEverything')) fail('tsc accepted an export the library does not have')

  // 14. A project made by init, far from this install: npm install, then the starter's own npm run check, as its README
  // says. The library comes from npm here, so the step waits for a library version that is published.
  if (libraryOnNpm) {
    const far = mkdtempSync(join(tmpdir(), 'openquarry-far-'))
    try {
      for (const starter of starters) {
        const project = join(far, starter.dest)
        if (run(bin, ['init', project, '--template', starter.id], far).status !== 0) fail(`${starter.id}: init into ${project} failed`)
        const own = sh('npm install --no-audit --no-fund\nnpm run check', project)
        if (own.status !== 0 || !own.lines.some((line) => / files checked, all valid\.$/.test(line))) fail(`${starter.id}: npm install and npm run check failed in a project made by init`)
      }
    } finally {
      rmSync(far, { recursive: true, force: true })
    }
    console.log('ok a project made by init passes its own npm run check after npm install')
  } else console.log(`${library.name}@${library.version} is not on npm yet: the starters' own npm run check waits for it`)

  console.log(`\nok openquarry ${cli.version} on Node ${process.versions.node}: packed, installed and every command run`)
} finally {
  rmSync(work, { recursive: true, force: true })
}
