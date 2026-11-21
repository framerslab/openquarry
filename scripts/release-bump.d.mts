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
