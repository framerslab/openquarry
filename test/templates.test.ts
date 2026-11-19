// The starters under templates/: each is a fabric with its manifest, one weave, one loom and one thread, every file valid
// under this build, with the same check script and the same dependencies. The README shows the commands that start a
// project from them exactly as scripts/start-commands.mjs writes them: the openquarry command's lines first, which CI
// runs from the packed tarball (scripts/check-cli.mjs), then the degit lines, which CI runs against the package from
// npm (scripts/check-start-commands.mjs).
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import { validateFabricManifest, validateLoom, validateThreadFrontmatter, validateWeave } from '../src/index.js'
import { beforeRelease, checkCommand, idCommand, initCommands, newCommands, newId, startCommands, starters } from '../scripts/start-commands.mjs'

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

  it('are started in the README with the commands the package page shows and CI runs, the openquarry command first', () => {
    const readme = read('README.md')
    const block = (name: string) => new RegExp(`<!-- commands: ${name} -->\\n\`\`\`bash\\n([\\s\\S]*?)\\n\`\`\``).exec(readme)?.[1]
    for (const starter of starters) {
      expect(block(`init-${starter.id}`), `init ${starter.id}`).toBe(initCommands(starter))
      expect(block(`new-${starter.id}`), `new ${starter.id}`).toBe(newCommands[starter.id])
      expect(block(starter.id), `degit ${starter.id}`).toBe(startCommands(starter))
    }
    expect(block('check')).toBe(checkCommand)
    expect(block('id')).toBe(idCommand)
    expect(initCommands(starters[0]).split('\n')[0]).toBe('npx openquarry init my-notes')
    expect(initCommands(starters[1]).split('\n')[0]).toBe('npx openquarry init my-course --template course')
    // The section opens the README's guide, and the command's lines come before the degit ones.
    const at = (text: string) => readme.indexOf(text)
    expect(at('## Start a project')).toBeGreaterThan(0)
    expect(at('## Start a project')).toBeLessThan(at('## A fabric on disk'))
    expect(at('<!-- commands: init-notes -->')).toBeGreaterThan(at('## Start a project'))
    for (const name of ['init-course', 'check', 'new-notes', 'new-course', 'id']) expect(at(`<!-- commands: ${name} -->`), name).toBeLessThan(at('<!-- commands: notes -->'))
    expect(readme).not.toContain('npm create')
    // The starters' own READMEs keep the line that prints an id with Node alone; CI's start job runs it.
    for (const starter of starters) expect(read(starter.folder, 'README.md')).toContain(newId)
    // Until the openquarry package is on npm, one sentence says so before the first command. The release removes it.
    if (beforeRelease) {
      expect(at(`> ${beforeRelease.text}\n`)).toBeGreaterThan(at('## Start a project'))
      expect(at(`> ${beforeRelease.text}\n`)).toBeLessThan(at('<!-- commands: init-notes -->'))
      // The command's lines are in Start a project alone, under that sentence: nowhere above it, and nowhere from the
      // degit lines on (the FAQ included), where a reader would meet them without it.
      expect(readme.slice(0, at(`> ${beforeRelease.text}\n`))).not.toContain('npx openquarry')
      expect(readme.slice(at('<!-- commands: notes -->'))).not.toContain('npx openquarry')
    } else expect(readme).not.toContain('not on npm yet')
  })
})
