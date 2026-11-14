// The README, the pages under docs/ and the changelog ship in the package. These tests hold what they show to the files
// and the validators: a block marked with an example's path is that file byte for byte, a reply the model guide calls
// valid passes the validator, the error lines it prints are the lines the validator gives, every relative link leads to
// a file the package ships, and the changelog opens with the package's version.
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import { describe, expect, it } from 'vitest'
import * as openquarry from '../src/index.js'

const root = fileURLToPath(new URL('..', import.meta.url))
const read = (...path: string[]) => readFileSync(join(root, ...path), 'utf8')
const docs = existsSync(join(root, 'docs')) ? readdirSync(join(root, 'docs')).filter((file) => file.endsWith('.md')).sort() : []
const pages = ['README.md', ...docs.map((file) => `docs/${file}`)]

/** The fenced blocks of a page that follow a marker comment: `<!-- marker: value -->`, then the fence on the next line. */
function marked(page: string, marker: string): { value: string; text: string }[] {
  const pattern = new RegExp(`<!-- ${marker}: (.+?) -->\\n\`\`\`[a-z]*\\n([\\s\\S]*?)\\n\`\`\``, 'g')
  return [...read(page).matchAll(pattern)].map((match) => ({ value: match[1], text: `${match[2]}\n` }))
}

/** The YAML between the two `---` lines at the top of a thread file. */
function frontmatter(text: string): string {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text)
  if (!match) throw new Error('no frontmatter')
  return match[1]
}

describe('the docs', () => {
  it('show the files of the example course as they are', () => {
    const shown = pages.flatMap((page) => [
      ...marked(page, 'file').map((block) => ({ page, ...block, file: read(block.value) })),
      ...marked(page, 'frontmatter').map((block) => ({ page, ...block, file: `${frontmatter(read(block.value))}\n` })),
    ])
    for (const { page, value, text, file } of shown) expect(text, `${page} shows ${value}`).toBe(file)
    const paths = new Set(shown.map(({ value }) => value))
    for (const file of [
      'catalogue.yaml',
      'weaves/reading-a-map/weave.yaml',
      'weaves/reading-a-map/finding-your-way/loom.yaml',
      'weaves/reading-a-map/the-map/scale-and-distance.md',
    ]) {
      expect(paths.has(`examples/reading-a-map/${file}`), file).toBe(true)
    }
  })

  it('give a model reply that validates, and for a refused reply the lines the validator gives', () => {
    const guide = 'docs/language-models.md'
    const reply = (value: string) => marked(guide, 'reply').filter((block) => block.value === value)[0].text
    expect(openquarry.validateThreadFrontmatter(yaml.load(frontmatter(reply('valid'))))).toEqual({ valid: true, errors: [] })
    const refused = openquarry.validateThreadFrontmatter(yaml.load(frontmatter(reply('refused'))))
    expect(refused.valid).toBe(false)
    const lines = marked(guide, 'lines').filter((block) => block.value === 'refused')[0].text
    expect([...refused.errors].sort()).toEqual(lines.trimEnd().split('\n').sort())
  })

  it('name every validator and schema the package exports, and every schema file it serves', () => {
    const readme = read('README.md')
    for (const name of Object.keys(openquarry)) expect(readme.includes(`\`${name}\``), name).toBe(true)
    for (const file of readdirSync(join(root, 'schema')).filter((name) => name.endsWith('.schema.yaml'))) {
      expect(readme.includes(`\`${file.replace(/\.yaml$/, '')}\``), file).toBe(true)
    }
  })

  it('link only to files the package ships', () => {
    const { files } = JSON.parse(read('package.json')) as { files: string[] }
    let links = 0
    for (const page of pages) {
      for (const match of read(page).matchAll(/\]\((?!https?:|mailto:|#)([^)#\s]+)(?:#[^)\s]*)?\)/g)) {
        const target = normalize(join(dirname(page), match[1]))
        expect(existsSync(join(root, target)), `${page} links to ${match[1]}`).toBe(true)
        const ships = files.some((entry) => target === entry || target.startsWith(`${entry}/`))
        expect(ships, `${page} links to ${match[1]}, which the package does not ship`).toBe(true)
        links += 1
      }
    }
    expect(links).toBeGreaterThan(0)
  })

  it('open the changelog with the version in package.json', () => {
    const { version } = JSON.parse(read('package.json')) as { version: string }
    expect(/^## (.+)$/m.exec(read('CHANGELOG.md'))?.[1]).toBe(version)
  })
})
