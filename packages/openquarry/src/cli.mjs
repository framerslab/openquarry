// The openquarry command. The first commit of this package answers --version alone: the commands follow, with the
// test that runs them from the packed tarball (scripts/check-cli.mjs) already in place.
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

export function run(argv) {
  if (argv.includes('--version') || argv.includes('-v')) {
    process.stdout.write(`${version}\n`)
    return 0
  }
  process.stderr.write('openquarry: the commands are not built yet\n')
  return 1
}
