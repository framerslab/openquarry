export interface Starter {
  id: string
  title: string
  folder: string
  dest: string
  text: string
}
export declare const repository: string
export declare const starters: Starter[]
export declare function startCommands(starter: Starter, ref?: string, from?: string): string
export declare const newId: string
export declare function initCommands(starter: Starter): string
export declare const checkCommand: string
export declare const newCommands: Record<string, string>
export declare const idCommand: string
export declare const beforeRelease: { version: string; text: string }
