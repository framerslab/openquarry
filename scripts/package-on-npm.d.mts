export declare const maintainers: string[]
export declare const source: { repository: string; workflow: string }
export declare function packageOnNpm(
  name: string,
  request?: (url: string) => Promise<{ status: number; ok: boolean; json(): Promise<any> }>,
): Promise<{ version: string | undefined }>
