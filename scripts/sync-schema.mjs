// Copies the schema files from a framerslab/codex checkout, records the commit and the files' SHA-256 in
// schema/SOURCE.json, and regenerates src/schemas.ts:
//   node scripts/sync-schema.mjs <path to the codex checkout>
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { isDeepStrictEqual } from 'node:util'
import yaml from 'js-yaml'
import { renderSchemasModule } from './build-schemas.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const codex = process.argv[2]
if (!codex) throw new Error('usage: node scripts/sync-schema.mjs <path to the codex checkout>')

// The recorded commit must describe the copied files, so a checkout with uncommitted schema changes is refused.
const dirty = execFileSync('git', ['status', '--porcelain', '--', 'schema'], { cwd: codex }).toString().trim()
if (dirty) throw new Error(`the codex checkout has uncommitted changes under schema/:\n${dirty}`)
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: codex }).toString().trim()
const schemaDir = join(root, 'schema')
const source = JSON.parse(readFileSync(join(schemaDir, 'SOURCE.json'), 'utf8'))
const schemaFiles = (dir) => readdirSync(dir).filter((file) => file.endsWith('.schema.yaml')).sort()
const alias = 'strand.schema.yaml'
for (const file of schemaFiles(join(codex, 'schema'))) {
  if (file !== alias && !source.maintainedHere.includes(file)) {
    copyFileSync(join(codex, 'schema', file), join(schemaDir, file))
  }
}
// Keep the deprecated schema self-contained so existing readers can compile it without resolving a reference.
const thread = yaml.load(readFileSync(join(schemaDir, 'thread.schema.yaml'), 'utf8'))
if (thread?.title !== 'ThreadFrontmatter') throw new Error('thread.schema.yaml must define ThreadFrontmatter')
const aliasSchema = {
  ...thread,
  title: 'StrandFrontmatter',
  description: 'Deprecated alias for thread.schema. Use thread.schema.json or thread.schema.yaml for new files.',
  deprecated: true,
}
const aliasPath = join(schemaDir, alias)
if (!existsSync(aliasPath) || !isDeepStrictEqual(yaml.load(readFileSync(aliasPath, 'utf8')), aliasSchema)) {
  writeFileSync(aliasPath, yaml.dump(aliasSchema, { noRefs: true }))
}

source.commit = commit
source.files = Object.fromEntries(schemaFiles(schemaDir).map((file) => [
  file, createHash('sha256').update(readFileSync(join(schemaDir, file))).digest('hex'),
]))
writeFileSync(join(schemaDir, 'SOURCE.json'), `${JSON.stringify(source, null, 2)}\n`)
writeFileSync(join(root, 'src', 'schemas.ts'), renderSchemasModule())
console.log(`schema files synced from framerslab/codex ${commit}`)
