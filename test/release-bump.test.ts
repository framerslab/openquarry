import { describe, expect, it } from 'vitest'
import { changelogLine, changelogSection, compareVersions, newestTag, nextVersion, withSection } from '../scripts/release-bump.mjs'

describe('the daily release version', () => {
  it('takes the next patch after the newest version npm serves', () => {
    expect(nextVersion('0.3.0', '0.3.0')).toBe('0.3.1')
    expect(nextVersion('0.3.0', '0.3.9')).toBe('0.3.10')
  })
  it('keeps a minor or major raised by hand in package.json', () => {
    expect(nextVersion('0.4.0', '0.3.7')).toBe('0.4.0')
    expect(nextVersion('1.0.0', '0.3.7')).toBe('1.0.0')
  })
  it('publishes the repository version of a package npm never served', () => {
    expect(nextVersion('0.1.0', null)).toBe('0.1.0')
  })
  it('compares versions by number, not as text', () => {
    expect(compareVersions('0.3.10', '0.3.9')).toBeGreaterThan(0)
    expect(compareVersions('0.10.0', '0.9.9')).toBeGreaterThan(0)
    expect(compareVersions('1.2.3', '1.2.3')).toBe(0)
  })
})

describe('the last release tag', () => {
  it('is the newest by version among the tags of that package', () => {
    expect(newestTag(['lib-v0.3.0', 'lib-v0.3.10', 'lib-v0.3.9', 'cli-v0.4.0'], 'lib-v')).toBe('lib-v0.3.10')
    expect(newestTag(['lib-v0.3.0', 'cli-v0.3.2', 'cli-v0.3.1'], 'cli-v')).toBe('cli-v0.3.2')
  })
  it('ignores tags that are not a plain version, and is null when there is none', () => {
    expect(newestTag(['lib-v0.3.0', 'lib-v0.4.0-rc.1', 'lib-vnext'], 'lib-v')).toBe('lib-v0.3.0')
    expect(newestTag(['v1.0.0', 'cli-v0.3.0'], 'lib-v')).toBeNull()
  })
})

describe('the changelog section of a release', () => {
  it('names a merged pull request by its title and number, and any other commit by its subject', () => {
    expect(changelogLine('Merge pull request #17 from framerslab/docs/start-commands-on-the-landing', 'Show how to start a project on the landing and the Courses guide\n')).toBe('- Show how to start a project on the landing and the Courses guide (#17)')
    expect(changelogLine('Fix the course example', '')).toBe('- Fix the course example')
  })
  it('opens with the version as its heading, which the docs test reads as the version', () => {
    const changelog = withSection('# Changelog\n\nEvery release, newest first.\n\n## 0.3.0\n\nThe course layer.\n', changelogSection('0.3.1', '21 November 2026', ['- One (#1)']))
    expect(/^## (.+)$/m.exec(changelog)?.[1]).toBe('0.3.1')
    expect(changelog.indexOf('## 0.3.1')).toBeLessThan(changelog.indexOf('## 0.3.0'))
    expect(changelog).toContain('Every release, newest first.\n\n## 0.3.1\n\nReleased on 21 November 2026')
    expect(changelogSection('0.3.2', '22 November 2026', [])).toContain('- Maintenance.')
  })
})
