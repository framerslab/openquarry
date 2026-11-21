/** One package of the daily release: its release tag prefix, the folder of its package.json and the paths it ships. */
export interface ReleasePackage {
  key: 'library' | 'command'
  tag: string
  dir: string
  paths: string[]
}
export declare const packages: ReleasePackage[]
/** Compares two x.y.z versions: negative, zero or positive. */
export declare function compareVersions(a: string, b: string): number
/** The version a changed package is published under. */
export declare function nextVersion(repoVersion: string, npmLatest: string | null): string
/** The newest release tag with this prefix, by version, or null. */
export declare function newestTag(tags: string[], prefix: string): string | null
/** A changelog line for one commit: a merged pull request by its title and number, any other commit by its subject. */
export declare function changelogLine(subject: string, body: string): string
/** The changelog section for a release. */
export declare function changelogSection(version: string, day: string, lines: string[]): string
/** Puts a section above the first release heading of a changelog. */
export declare function withSection(changelog: string, section: string): string
