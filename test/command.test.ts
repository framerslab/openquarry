// The openquarry package under packages/openquarry: the command built on this library. CI proves the command itself
// from its packed tarball (scripts/check-cli.mjs). These tests hold what a tarball cannot show: that it is the one
// package beside the library, under the same licence, on the library's version line, with the commands its README
// shows being the documented ones; and the reading of the npm registry that decides whether the package of that name on
// npm is ours before CI runs anything from it (scripts/package-on-npm.mjs).
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { packageOnNpm } from '../scripts/package-on-npm.mjs'
import { beforeRelease, checkCommand, idCommand, initCommands, newCommands, pinnedTo, starters } from '../scripts/start-commands.mjs'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (...path: string[]) => readFileSync(join(root, ...path), 'utf8')
const library = JSON.parse(read('package.json')) as Record<string, any>
const command = JSON.parse(read('packages', 'openquarry', 'package.json')) as Record<string, any>

describe('the openquarry package', () => {
  it('is the one package beside the library: named openquarry, MIT, with the only bin', () => {
    expect(readdirSync(join(root, 'packages'))).toEqual(['openquarry'])
    expect(command.name).toBe('openquarry')
    expect(command.license).toBe('MIT')
    expect(command.license).toBe(library.license)
    expect(command.author).toBe(library.author)
    expect(read('packages', 'openquarry', 'LICENSE')).toBe(read('LICENSE'))
    expect(command.bin).toEqual({ openquarry: 'bin/openquarry.mjs' })
    expect(library.bin).toBeUndefined()
    expect(read('packages', 'openquarry', 'bin', 'openquarry.mjs').startsWith('#!/usr/bin/env node\n')).toBe(true)
    // Provenance needs the manifest to name the public repository the package is published from.
    expect(command.repository).toEqual({ ...library.repository, directory: 'packages/openquarry' })
    expect(command.publishConfig).toEqual({ access: 'public', provenance: true })
    expect(command.engines).toEqual({ node: '>=18' })
  })

  it("follows the library's major and minor version, depends on that line of it, and re-exports it", () => {
    const [major, minor] = String(library.version).split('.')
    expect(String(command.version).startsWith(`${major}.${minor}.`)).toBe(true)
    expect(command.dependencies['@framers/openquarry']).toBe(`^${major}.${minor}.0`)
    expect(Object.keys(command.dependencies).sort()).toEqual(['@framers/openquarry', 'yaml'])
    expect(/^## (.+)$/m.exec(read('packages', 'openquarry', 'CHANGELOG.md'))?.[1]).toBe(command.version)
    expect(read('CHANGELOG.md')).toContain('https://github.com/framerslab/openquarry/blob/master/packages/openquarry/CHANGELOG.md')
    for (const file of ['index.js', 'index.d.ts', 'index.d.cts']) expect(read('packages', 'openquarry', file)).toBe("export * from '@framers/openquarry'\n")
    expect(read('packages', 'openquarry', 'index.cjs')).toBe("module.exports = require('@framers/openquarry')\n")
    // The starters are bundled into the package when it is packed; the copy is never committed.
    expect(command.scripts).toEqual({ prepack: 'node scripts/bundle-templates.mjs' })
    expect(command.files).toContain('templates')
    expect(read('.gitignore')).toContain('packages/openquarry/templates/\n')
  })

  it('shows the documented commands in its README', () => {
    const readme = read('packages', 'openquarry', 'README.md')
    for (const line of [...starters.map((starter) => initCommands(starter).split('\n')[0]), checkCommand, newCommands.notes, newCommands.course, idCommand]) {
      expect(readme, line).toContain(`${line}\n`)
    }
    expect(readme).toContain(initCommands(starters[0]))
  })

  it('runs against npm only on the version whose maintainers and provenance CI read, and gives readers no test a stranger could pass', () => {
    // CI runs the documented lines against npm pinned to the version it has just read; a newer one published meanwhile
    // is never what runs.
    const lines = [...starters.map((starter) => initCommands(starter)), checkCommand, newCommands.notes, newCommands.course, idCommand].join('\n')
    const count = lines.split('npx openquarry ').length - 1
    const pinned = pinnedTo('0.3.0', lines)
    expect(count).toBe(8)
    expect(pinned.match(/npx openquarry\S*/g)).toEqual(Array(count).fill('npx openquarry@0.3.0'))
    expect(pinned.replaceAll('npx openquarry@0.3.0 ', 'npx openquarry ')).toBe(lines)
    // Before the release, the note above the commands names no check a reader could run (a version npm prints): anyone
    // could publish under the free name at that version.
    if (beforeRelease) expect(beforeRelease.text).not.toMatch(/npm view|prints/)
  })
})

// What the registry answers, as far as the reading goes: the package record, and the provenance statement inside its
// attestation, shaped as npm serves them for @framers/openquarry.
function registry({ maintainers = ['jdunnfive', 'manicteam'], repository = 'git+https://github.com/framerslab/openquarry.git', workflow = { ref: 'refs/heads/master', repository: 'https://github.com/framerslab/openquarry', path: '.github/workflows/release.yml' } as Record<string, string> | null, subject = 'pkg:npm/openquarry@0.3.0', attested = 200, found = 200 } = {}) {
  const statement = { _type: 'https://in-toto.io/Statement/v1', subject: [{ name: subject }], predicateType: 'https://slsa.dev/provenance/v1', predicate: { buildDefinition: { externalParameters: { workflow } } } }
  const publish = { predicateType: 'https://github.com/npm/attestation/tree/main/specs/publish/v0.1', subject: [{ name: subject }], predicate: {} }
  const wrap = (value: unknown) => ({ bundle: { dsseEnvelope: { payload: Buffer.from(JSON.stringify(value)).toString('base64') } } })
  const asked: string[] = []
  const request = async (url: string) => {
    asked.push(url)
    const attestation = url.includes('/-/npm/v1/attestations/')
    const status = attestation ? attested : found
    const body = attestation
      ? { attestations: [wrap(publish), ...(workflow ? [wrap(statement)] : [])] }
      : { 'dist-tags': { latest: '0.3.0' }, maintainers: maintainers.map((name) => ({ name, email: `${name}@example.com` })), versions: { '0.3.0': { repository: { url: repository } } } }
    return { status, ok: status >= 200 && status < 300, json: async () => body }
  }
  return { request, asked }
}

describe('the reading of npm that decides whether a package there is ours', () => {
  it('says a name npm does not have is absent, and asks for nothing more', async () => {
    const { request, asked } = registry({ found: 404 })
    expect(await packageOnNpm('openquarry', request)).toEqual({ version: undefined })
    expect(asked).toEqual(['https://registry.npmjs.org/openquarry'])
  })

  it('gives the newest version when our accounts maintain the package and its provenance is this repository and its release workflow', async () => {
    const { request, asked } = registry()
    expect(await packageOnNpm('openquarry', request)).toEqual({ version: '0.3.0' })
    expect(asked).toEqual(['https://registry.npmjs.org/openquarry', 'https://registry.npmjs.org/-/npm/v1/attestations/openquarry@0.3.0'])
    const scoped = registry({ subject: 'pkg:npm/%40framers/openquarry@0.3.0' })
    expect(await packageOnNpm('@framers/openquarry', scoped.request)).toEqual({ version: '0.3.0' })
    expect(scoped.asked).toEqual(['https://registry.npmjs.org/@framers%2fopenquarry', 'https://registry.npmjs.org/-/npm/v1/attestations/@framers%2fopenquarry@0.3.0'])
  })

  it('stops on a package of that name from anyone else, whatever the package says of itself', async () => {
    const refused = (options: Parameters<typeof registry>[0]) => packageOnNpm('openquarry', registry(options).request)
    // A stranger alone, and a stranger beside one of our accounts.
    await expect(refused({ maintainers: ['someone-else'] })).rejects.toThrow('The name openquarry on npm belongs to someone else: its maintainers are someone-else. Nothing from it was run.')
    await expect(refused({ maintainers: ['jdunnfive', 'someone-else'] })).rejects.toThrow('belongs to someone else')
    await expect(refused({ maintainers: [] })).rejects.toThrow('belongs to someone else: its maintainers are not listed')
    // Our accounts, but another repository in the manifest, no attestation, no provenance statement in it, or a
    // provenance that names another repository, another workflow or another package.
    await expect(refused({ repository: 'git+https://github.com/someone-else/openquarry.git' })).rejects.toThrow('names the repository')
    await expect(refused({ repository: 'git+https://github.com/framerslab/openquarry-fork.git' })).rejects.toThrow('names the repository')
    await expect(refused({ attested: 404 })).rejects.toThrow('openquarry@0.3.0 on npm has no provenance attestation (the registry answered 404). Nothing from it was run.')
    await expect(refused({ workflow: null })).rejects.toThrow('was not built by .github/workflows/release.yml of https://github.com/framerslab/openquarry')
    await expect(refused({ workflow: { repository: 'https://github.com/someone-else/openquarry', path: '.github/workflows/release.yml' } })).rejects.toThrow('was not built by')
    await expect(refused({ workflow: { repository: 'https://github.com/framerslab/openquarry', path: '.github/workflows/other.yml' } })).rejects.toThrow('was not built by')
    await expect(refused({ subject: 'pkg:npm/openquarry@0.2.0' })).rejects.toThrow('was not built by')
    // A registry that cannot be read is never taken for an absent package.
    await expect(refused({ found: 503 })).rejects.toThrow('The npm registry answered 503 for openquarry')
  })
})
