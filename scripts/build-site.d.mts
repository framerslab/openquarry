export declare const ORIGIN: string
export declare const SCHEMA_PATH: string
export declare const REPOSITORY: string
export declare const NPM: string
export declare function schemaFiles(): string[]
export interface SiteIndex {
  format: string
  schemas: { name: string; title?: string; url: string; yaml: string; sha256: string }[]
  source: { repository: string; commit: string; path: string }
  package: { name: string; version: string; npm: string }
  repository: string
  builtFrom: string
}
export declare function buildSite(out?: string): SiteIndex
