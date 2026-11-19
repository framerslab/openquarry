// The starters under templates/: each is a fabric with its manifest, one weave, one loom and one thread, every file valid
// under this build, with the same check script and the same dependencies. The README shows the commands that start a
// project from them exactly as scripts/start-commands.mjs writes them; CI runs those commands against the package from
// npm (scripts/check-start-commands.mjs).
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import { validateFabricManifest, validateLoom, validateThreadFrontmatter, validateWeave } from '../src/index.js'
import { newId, startCommands, starters } from '../scripts/start-commands.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (...path: string[]) => readFileSync(join(root, ...path), 'utf8')

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [relative(join(root), join(dir, entry.name)).split(sep).join('/')],
  )
}

/** The YAML between the two `---` lines at the top of a thread file. */
function frontmatter(text: string): unknown {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (!match) throw new Error('no frontmatter')
  return yaml.load(match[1])
}

describe('the starters', () => {
  it('are the two folders under templates/, each named in the start commands', () => {
    expect(readdirSync(join(root, 'templates')).sort()).toEqual(starters.map((s) => s.folder.replace('templates/', '')).sort())
  })

  for (const starter of starters) {
    it(`${starter.id}: holds a fabric manifest, one weave, one loom and one thread, each valid`, () => {
      const files = walk(join(root, starter.folder)).map((file) => file.slice(starter.folder.length + 1))
      const weaves = files.filter((file) => /^weaves\/[^/]+\/weave\.yaml$/.test(file))
      const looms = files.filter((file) => file.startsWith('weaves/') && file.endsWith('/loom.yaml'))
      const threads = files.filter((file) => file.startsWith('weaves/') && file.endsWith('.md'))
      expect(files).toContain('fabric.yaml')
      expect(weaves).toHaveLength(1)
      expect(looms).toHaveLength(1)
      expect(threads).toHaveLength(1)
      const at = (file: string) => read(starter.folder, file)
      expect(validateFabricManifest(yaml.load(at('fabric.yaml')))).toEqual({ valid: true, errors: [] })
      expect(validateWeave(yaml.load(at(weaves[0])))).toEqual({ valid: true, errors: [] })
      expect(validateLoom(yaml.load(at(looms[0])))).toEqual({ valid: true, errors: [] })
      expect(validateThreadFrontmatter(frontmatter(at(threads[0])))).toEqual({ valid: true, errors: [] })
      // The weave's folder is its slug, and the loom sits inside it.
      const weave = yaml.load(at(weaves[0])) as { slug: string; kind?: string }
      expect(weaves[0]).toBe(`weaves/${weave.slug}/weave.yaml`)
      expect(looms[0].startsWith(`weaves/${weave.slug}/`)).toBe(true)
      if (starter.id === 'course') {
        expect(weave.kind).toBe('course')
        expect((yaml.load(at(looms[0])) as { kind?: string }).kind).toBe('unit')
        expect((frontmatter(at(threads[0])) as { contentType: string }).contentType).toBe('lesson')
      }
      // A content licence is stated, so a tool that fills in defaults never writes MIT in its place.
      expect((yaml.load(at(weaves[0])) as { license?: string }).license).toBe('All rights reserved')
      expect((frontmatter(at(threads[0])) as { publishing?: { license?: string } }).publishing?.license).toBe('All rights reserved')
    })
  }

  it('share one check script, one Node range and the same dependencies, and run the check with npm run check', () => {
    const [first, ...rest] = starters
    for (const starter of rest) expect(read(starter.folder, 'check.mjs')).toBe(read(first.folder, 'check.mjs'))
    const manifests = starters.map((s) => JSON.parse(read(s.folder, 'package.json')) as Record<string, any>)
    for (const [i, manifest] of manifests.entries()) {
      expect(manifest.name).toBe(starters[i].dest)
      expect(manifest.private).toBe(true)
      expect(manifest.type).toBe('module')
      expect(manifest.scripts).toEqual({ check: 'node check.mjs' })
      expect(Object.keys(manifest.devDependencies).sort()).toEqual(['@framers/openquarry', 'yaml'])
      expect(manifest.devDependencies).toEqual(manifests[0].devDependencies)
      expect(manifest.engines).toEqual(manifests[0].engines)
    }
  })

  it('give each thread its own id', () => {
    const ids = starters.flatMap((s) => walk(join(root, s.folder)).filter((f) => f.endsWith('.md') && f.includes('/weaves/')).map((f) => (frontmatter(read(f)) as { id: string }).id))
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('are started in the README with the commands the package page shows and CI runs', () => {
    const readme = read('README.md')
    const block = (name: string) => new RegExp(`<!-- commands: ${name} -->\\n\`\`\`bash\\n([\\s\\S]*?)\\n\`\`\``).exec(readme)?.[1]
    for (const starter of starters) expect(block(starter.id), starter.id).toBe(startCommands(starter))
    expect(block('id')).toBe(newId)
    expect(readme.indexOf('## Start a project')).toBeLessThan(readme.indexOf('## A fabric on disk'))
    expect(readme).toContain('`npm create openquarry` arrives with the next release.')
  })
})
