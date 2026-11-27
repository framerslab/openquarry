import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import type { ErrorObject, ValidateFunction } from 'ajv'
import { blocksIndexSchema, catalogueSchema, fabricSchema, loomSchema, threadSchema, weaveSchema } from './schemas.js'
import type { BlocksIndex, Catalogue } from './types.js'

export interface ValidationResult {
  valid: boolean
  /** One line per problem: the path inside the value, then what is wrong with it. */
  errors: string[]
  /** Advisory messages for accepted inputs that use a deprecated spelling. */
  warnings?: string[]
}

export interface NormalizedValidationResult<T> extends ValidationResult {
  /** Present when the input is valid. Uses the current field names. */
  value?: T
}

const compiled = new Map<object, ValidateFunction>()
const compiledOwnProperties = new Map<object, ValidateFunction>()

function validatorFor(schema: Record<string, unknown>, ownProperties = false): ValidateFunction {
  const cache = ownProperties ? compiledOwnProperties : compiled
  let validate = cache.get(schema)
  if (!validate) {
    // verbose: an error carries the value it is about, which the line for a value listed twice quotes.
    const ajv = new Ajv2020({ allErrors: true, strict: false, verbose: true, ownProperties })
    addFormats(ajv)
    validate = ajv.compile(schema)
    cache.set(schema, validate)
  }
  return validate
}

/**
 * One line for a problem: the path inside the value, then what is wrong, with what Ajv's message leaves out: the values
 * an enum or a const allows, the key a closed record refuses, and the value a list holds twice.
 */
function line(error: ErrorObject): string {
  if (error.keyword === 'uniqueItems' && Array.isArray(error.data)) {
    // Ajv names the two places; the line points at the later one and quotes the value.
    const again = Math.max(Number(error.params.i), Number(error.params.j))
    return `${error.instancePath}/${again} is listed twice: ${JSON.stringify(error.data[again])}`
  }
  return `${error.instancePath || '/'} ${describe(error)}`
}

function describe(error: ErrorObject): string {
  const message = error.message ?? 'is invalid'
  if (error.keyword === 'additionalProperties' && typeof error.params.additionalProperty === 'string') {
    return `${message}: ${JSON.stringify(error.params.additionalProperty)}`
  }
  if (error.keyword === 'enum' && Array.isArray(error.params.allowedValues)) {
    return `${message}: ${error.params.allowedValues.map((allowed: unknown) => JSON.stringify(allowed)).join(', ')}`
  }
  if (error.keyword === 'const' && 'allowedValue' in error.params) {
    return `${message}: ${JSON.stringify(error.params.allowedValue)}`
  }
  return message
}

function check(
  schema: Record<string, unknown>, value: unknown,
  { includeError, ownProperties }: { includeError?: (error: ErrorObject) => boolean; ownProperties?: boolean } = {},
): ValidationResult {
  const validate = validatorFor(schema, ownProperties)
  const valid = validate(value) as boolean
  const errors = validate.errors ?? []
  return { valid, errors: (includeError ? errors.filter(includeError) : errors).map(line) }
}

function renameField(
  record: Record<string, unknown>, legacy: string, current: string, warnings: Set<string>, path = current,
): void {
  if (!Object.hasOwn(record, legacy)) return
  if (record[current] === undefined) record[current] = record[legacy]
  delete record[legacy]
  warnings.add(path)
}

/** Checks a thread's frontmatter (already parsed from YAML) against thread.schema.yaml. */
export function validateThreadFrontmatter(frontmatter: unknown): ValidationResult {
  return check(threadSchema, frontmatter)
}

/** Checks a parsed loom.yaml against loom.schema.yaml. */
export function validateLoom(loom: unknown): ValidationResult {
  return check(loomSchema, loom)
}

/** Checks a parsed weave.yaml against weave.schema.yaml. */
export function validateWeave(weave: unknown): ValidationResult {
  return check(weaveSchema, weave)
}

/** Checks a parsed fabric.yaml against fabric.schema.yaml. */
export function validateFabricManifest(manifest: unknown): ValidationResult {
  return check(fabricSchema, manifest)
}

/**
 * Each circle in a set of links, as the ids along it: `['a', 'b', 'a']` when a links to b and b to a.
 *
 * A depth-first walk that keeps its own stack, so a chain of any length takes no call per link, and a map from each id
 * on the path to its place, so finding a circle takes no search of the path.
 */
function circles(links: Map<string, string[]>): string[][] {
  const found: string[][] = []
  const settled = new Set<string>()
  const path: string[] = []
  const placeOnPath = new Map<string, number>()
  // For each place on the path, how many of that id's links the walk has followed.
  const followed: number[] = []
  const enter = (id: string): void => {
    placeOnPath.set(id, path.length)
    path.push(id)
    followed.push(0)
  }
  for (const start of links.keys()) {
    if (settled.has(start)) continue
    enter(start)
    while (path.length > 0) {
      const top = path.length - 1
      const id = path[top]
      const out = links.get(id) ?? []
      if (followed[top] === out.length) {
        path.pop()
        followed.pop()
        placeOnPath.delete(id)
        settled.add(id)
        continue
      }
      const next = out[followed[top]]
      followed[top] += 1
      const at = placeOnPath.get(next)
      if (at !== undefined) found.push([...path.slice(at), next])
      else if (!settled.has(next)) enter(next)
    }
  }
  return found
}

/**
 * The four rules catalogue.schema.yaml states in words, which a JSON Schema cannot hold: a subject id and an entry
 * slug are each listed once, a link names something the catalogue lists, an entry's home is one of its subjects, and no
 * chain of links comes back to where it started.
 */
function catalogueLinkErrors(catalogue: Catalogue): string[] {
  const errors: string[] = []
  const quote = (value: string) => JSON.stringify(value)

  const subjectAt = new Map<string, number>()
  catalogue.subjects.forEach((subject, index) => {
    if (subjectAt.has(subject.id)) errors.push(`/subjects/${index}/id is listed twice: ${quote(subject.id)}`)
    else subjectAt.set(subject.id, index)
  })
  catalogue.subjects.forEach((subject, index) => {
    subject.broader.forEach((id, at) => {
      if (!subjectAt.has(id)) {
        errors.push(`/subjects/${index}/broader/${at} names a subject the catalogue does not list: ${quote(id)}`)
      }
    })
  })

  const entryAt = new Map<string, number>()
  catalogue.entries.forEach((entry, index) => {
    if (entryAt.has(entry.slug)) errors.push(`/entries/${index}/slug is listed twice: ${quote(entry.slug)}`)
    else entryAt.set(entry.slug, index)
  })
  catalogue.entries.forEach((entry, index) => {
    // The schema holds "each once" for an entry's subjects, so no subject is listed twice here.
    entry.subjects.forEach((id, at) => {
      if (!subjectAt.has(id)) {
        errors.push(`/entries/${index}/subjects/${at} names a subject the catalogue does not list: ${quote(id)}`)
      }
    })
    if (!entry.subjects.includes(entry.home)) {
      errors.push(`/entries/${index}/home must be one of the entry's subjects: ${entry.subjects.map(quote).join(', ')}`)
    }
    entry.requires.forEach((slug, at) => {
      if (!entryAt.has(slug)) {
        errors.push(`/entries/${index}/requires/${at} names an entry the catalogue does not list: ${quote(slug)}`)
      }
    })
  })

  // A circle is read from the first listing of each id, so a repeated id (reported above) adds no second walk.
  const broader = new Map<string, string[]>()
  for (const [id, index] of subjectAt) broader.set(id, catalogue.subjects[index].broader)
  for (const circle of circles(broader)) {
    errors.push(`/subjects/${subjectAt.get(circle[0])}/broader makes a circle: ${circle.map(quote).join(' > ')}`)
  }
  const requires = new Map<string, string[]>()
  for (const [slug, index] of entryAt) requires.set(slug, catalogue.entries[index].requires)
  for (const circle of circles(requires)) {
    errors.push(`/entries/${entryAt.get(circle[0])}/requires makes a circle: ${circle.map(quote).join(' > ')}`)
  }
  return errors
}

/**
 * Checks a parsed catalogue.yaml against catalogue.schema.yaml. When the record has the schema's shape, it also checks
 * the rules the schema states in words: each subject id and entry slug is listed once, every link names a subject or
 * an entry the catalogue lists, an entry's `home` is one of its `subjects`, and neither `broader` nor `requires` makes
 * a circle.
 */
export function validateCatalogue(catalogue: unknown): ValidationResult {
  const shape = check(catalogueSchema, catalogue)
  if (!shape.valid) return shape
  const errors = catalogueLinkErrors(catalogue as Catalogue)
  return { valid: errors.length === 0, errors }
}

// For each missing alias pair, keep the error from the current spelling (the first branch).
const redundantBlocksIndexErrors = new Set([
  '#/anyOf',
  '#/properties/stats/anyOf',
  '#/properties/tagIndex/additionalProperties/items/anyOf',
].flatMap((path) => [path, `${path}/1/required`]))

function copyOwnFields(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.getOwnPropertyNames(record).map((key) => [key, record[key]]))
}

/** Checks a parsed blocks index. Pass `{ normalize: true }` to read it with current field names. */
export function validateBlocksIndex(index: unknown): ValidationResult
export function validateBlocksIndex(index: unknown, options: { normalize: true }): NormalizedValidationResult<BlocksIndex>
export function validateBlocksIndex(index: unknown, options?: { normalize: true }): NormalizedValidationResult<BlocksIndex> {
  const result = check(blocksIndexSchema, index, {
    includeError: (error) => !redundantBlocksIndexErrors.has(error.schemaPath),
    // The result only copies own fields. Validate that same data when normalization is requested.
    ownProperties: options?.normalize,
  })
  if (!result.valid || !options?.normalize) return result

  const value = copyOwnFields(index as Record<string, unknown>)
  const fields = new Set<string>()
  renameField(value, 'strands', 'threads', fields)
  const stats = copyOwnFields(value.stats as Record<string, unknown>)
  renameField(stats, 'totalStrands', 'totalThreads', fields, 'stats.totalThreads')
  value.stats = stats
  if (value.tagIndex !== undefined) {
    const tagIndex = value.tagIndex as Record<string, Record<string, unknown>[]>
    value.tagIndex = Object.fromEntries(Object.entries(tagIndex).map(([tag, entries]) => [
      tag,
      entries.map((entry) => {
        const reference = copyOwnFields(entry)
        renameField(reference, 'strandPath', 'threadPath', fields, 'tagIndex[].threadPath')
        return reference
      }),
    ]))
  }
  return {
    ...result,
    value: value as unknown as BlocksIndex,
    ...(fields.size ? { warnings: [`Deprecated fields: use ${[...fields].join(', ')}.`] } : {}),
  }
}
