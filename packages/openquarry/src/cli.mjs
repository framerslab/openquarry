// The openquarry command line: reads the arguments, runs one command and returns the exit code.
//   0  done
//   1  the command refused to go on or found a problem (one line on standard error; the check's report is on
//      standard output)
//   2  the command line is wrong
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { check } from './check.mjs'
import { Refusal, UsageError } from './errors.mjs'
import { init, templateNames } from './init.mjs'
import { newThread } from './new.mjs'

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

// Each command's options: true for one that takes a value.
const options = {
  init: { template: true, force: false },
  new: { in: true, slug: true },
  check: {},
  id: {},
}

function help() {
  const templates = templateNames().join('|') || 'notes|course'
  return `openquarry ${version}: start a folder of notes or a course in the OpenQuarry format, add notes and lessons, and check every file.

Usage:
  openquarry init [folder] [--template ${templates}] [--force]
  openquarry new note|lesson <title> [--in <folder>] [--slug <slug>]
  openquarry check [folder]
  openquarry id

Commands:
  init    Start a project from a template, in the folder you name or in the current one.
          A folder that is not empty is refused unless --force, which adds the files that
          are missing. No file is ever overwritten.
  new     Write a note or a lesson: a Markdown file with a new id, a slug from the title,
          version 1.0.0 and its contentType. --in names the folder, --slug the file name.
  check   Validate fabric.yaml, catalogue.yaml and, under weaves/, every weave.yaml,
          loom.yaml and Markdown file. Exits with 1 when a file is invalid.
  id      Print a new UUID.

Options:
  -h, --help       Show this help.
  -v, --version    Show the version.

Docs: https://openquarry.dev/package/#start
`
}

// Splits the arguments after the command into its options and the rest. `--` ends the options.
function parse(command, args) {
  const known = options[command]
  const given = {}
  const rest = []
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    if (arg === '--') {
      rest.push(...args.slice(index + 1))
      break
    }
    if (arg.startsWith('--')) {
      const equals = arg.indexOf('=')
      const name = equals === -1 ? arg.slice(2) : arg.slice(2, equals)
      if (!Object.hasOwn(known, name)) throw new UsageError(`no option named --${name}`)
      if (known[name]) {
        if (equals === -1 && index + 1 >= args.length) throw new UsageError(`--${name} needs a value`)
        given[name] = equals === -1 ? args[(index += 1)] : arg.slice(equals + 1)
      } else {
        if (equals !== -1) throw new UsageError(`--${name} takes no value`)
        given[name] = true
      }
    } else if (arg.startsWith('-') && arg.length > 1) throw new UsageError(`no option named ${arg}`)
    else rest.push(arg)
  }
  return { given, rest }
}

const commands = {
  init(args, cwd) {
    const { given, rest } = parse('init', args)
    if (rest.length > 1) throw new UsageError(`one folder at most, got ${rest.length}`)
    return { lines: init({ folder: rest[0], template: given.template, force: given.force, cwd }), code: 0 }
  },
  new(args, cwd) {
    const { given, rest } = parse('new', args)
    if (rest.length > 2) throw new UsageError(`one title, in quotes when it has spaces: got ${rest.length - 1}`)
    return { lines: newThread({ kind: rest[0], title: rest[1], folder: given.in, slug: given.slug, cwd }), code: 0 }
  },
  check(args, cwd) {
    const { rest } = parse('check', args)
    if (rest.length > 1) throw new UsageError(`one folder at most, got ${rest.length}`)
    const { lines, valid } = check({ folder: rest[0], cwd })
    return { lines, code: valid ? 0 : 1 }
  },
  id(args) {
    const { rest } = parse('id', args)
    if (rest.length > 0) throw new UsageError('takes no argument')
    return { lines: [randomUUID()], code: 0 }
  },
}

/** Runs the command line and returns the exit code. `io` is where the lines go and the folder the paths start from. */
export function run(argv, io = {}) {
  const out = io.out ?? ((text) => process.stdout.write(text))
  const err = io.err ?? ((text) => process.stderr.write(text))
  const cwd = io.cwd ?? process.cwd()
  // Before `--`, -h or --help prints the help and -v or --version the version, whatever else is there.
  const end = argv.indexOf('--')
  const flags = end === -1 ? argv : argv.slice(0, end)
  if (flags.includes('--help') || flags.includes('-h') || argv[0] === 'help' || argv.length === 0) {
    out(help())
    return 0
  }
  if (flags.includes('--version') || flags.includes('-v')) {
    out(`${version}\n`)
    return 0
  }
  const [command, ...args] = argv
  const prefix = Object.hasOwn(commands, command) ? `openquarry ${command}` : 'openquarry'
  try {
    if (!Object.hasOwn(commands, command)) throw new UsageError(command.startsWith('-') ? `no option named ${command}` : `no command named ${JSON.stringify(command)}`)
    const { lines, code } = commands[command](args, cwd)
    out(`${lines.join('\n')}\n`)
    return code
  } catch (error) {
    if (error instanceof UsageError) {
      err(`${prefix}: ${error.message}\nRun openquarry --help for the commands.\n`)
      return 2
    }
    // A refusal, or the file system's own answer (no permission, a full disk): one line, never a stack trace.
    err(`${prefix}: ${String(error?.message ?? error).split('\n')[0]}\n`)
    return 1
  }
}
