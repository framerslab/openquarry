// Run by npm before the package is packed (prepack): copies the starters under templates/ at the repository root into
// this package's templates/ folder, byte for byte, so `openquarry init` works with no network.
// npm never packs a nested .gitignore, so a path segment that starts with a dot is stored as _dot_ plus the rest
// (.gitignore becomes _dot_gitignore); init writes it back under its own name.
import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = join(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(here, '..', '..', 'templates')
const dest = join(here, 'templates')

if (!existsSync(source)) {
  // Packed again from an unpacked tarball: the starters are already here.
  if (existsSync(dest)) process.exit(0)
  throw Error(`No starters to bundle: ${source} is missing`)
}

const stored = (segment) => {
  if (segment.startsWith('_dot_')) throw Error(`A starter holds ${segment}: a name that starts with _dot_ cannot be bundled`)
  if (segment.toLowerCase() === '.git') throw Error('A starter holds a .git entry: it is never bundled')
  return segment.startsWith('.') ? `_dot_${segment.slice(1)}` : segment
}

let count = 0
function copy(from, to, shown) {
  for (const name of readdirSync(from).sort()) {
    const path = join(from, name)
    const info = lstatSync(path)
    if (info.isDirectory()) copy(path, join(to, stored(name)), `${shown}/${name}`)
    else if (info.isFile()) {
      mkdirSync(to, { recursive: true })
      writeFileSync(join(to, stored(name)), readFileSync(path))
      count += 1
    } else throw Error(`${shown}/${name} is not a plain file or a folder: it cannot be bundled`)
  }
}

rmSync(dest, { recursive: true, force: true })
const names = readdirSync(source).filter((name) => lstatSync(join(source, name)).isDirectory()).sort()
for (const name of names) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) throw Error(`A starter's folder name is lowercase letters, digits and hyphens: ${name}`)
  copy(join(source, name), join(dest, name), `templates/${name}`)
}
// Standard error, so a tool that reads npm pack's standard output sees npm's lines only.
console.error(`Bundled ${count} files of ${names.length} starters: ${names.join(', ')}`)
