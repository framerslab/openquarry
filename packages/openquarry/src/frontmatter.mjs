// How a thread's YAML block is found and read: the same pattern and the same parser for the check and for the file
// `new` writes, so what `new` writes is read back exactly as `check` will read it.
import { parse } from 'yaml'

/** The YAML between the two --- lines at the top of a Markdown file, or undefined when the file has no such block. */
export const block = (text) => /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text)?.[1]

/** A file's text without a leading byte-order mark. */
export const unmarked = (text) => text.replace(/^\ufeff/, '')

export { parse }
