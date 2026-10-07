// Copies the schema files from a framerslab/codex checkout, records the commit and the files' SHA-256 in
// schema/SOURCE.json, and regenerates src/schemas.ts:
//   node scripts/sync-schema.mjs <path to the codex checkout>
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderSchemasModule } from './build-schemas.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const codex = process.argv[2]
if (!codex) throw new Error('usage: node scripts/sync-schema.mjs <path to the codex checkout>')

// The recorded commit must describe the copied files, so a checkout with uncommitted schema changes is refused.
const dirty = execFileSync('git', ['status', '--porcelain', '--', 'schema'], { cwd: codex }).toString().trim()
if (dirty) throw new Error(`the codex checkout has uncommitted changes under schema/:\n${dirty}`)
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: codex }).toString().trim()
const files = readdirSync(join(codex, 'schema')).filter((file) => file.endsWith('.schema.yaml')).sort()
const source = JSON.parse(readFileSync(join(root, 'schema', 'SOURCE.json'), 'utf8'))
source.commit = commit
source.files = {}
for (const file of files) {
  copyFileSync(join(codex, 'schema', file), join(root, 'schema', file))
  source.files[file] = createHash('sha256').update(readFileSync(join(root, 'schema', file))).digest('hex')
}
writeFileSync(join(root, 'schema', 'SOURCE.json'), `${JSON.stringify(source, null, 2)}\n`)
writeFileSync(join(root, 'src', 'schemas.ts'), renderSchemasModule())
console.log(`schema files synced from framerslab/codex ${commit}`)
