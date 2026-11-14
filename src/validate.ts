import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import type { ErrorObject, ValidateFunction } from 'ajv'
import { blocksIndexSchema, catalogueSchema, fabricSchema, loomSchema, threadSchema, weaveSchema } from './schemas.js'
import type { Catalogue } from './types.js'

export interface ValidationResult {
  valid: boolean
  /** One line per problem: the path inside the value, then what is wrong with it. */
  errors: string[]
}

const compiled = new Map<object, ValidateFunction>()

function validatorFor(schema: Record<string, unknown>): ValidateFunction {
  let validate = compiled.get(schema)
  if (!validate) {
    const ajv = new Ajv2020({ allErrors: true, strict: false })
    addFormats(ajv)
    validate = ajv.compile(schema)
    compiled.set(schema, validate)
  }
  return validate
}

/** What is wrong, with what Ajv's message leaves out: the values an enum or a const allows, and the key a closed record refuses. */
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

function check(schema: Record<string, unknown>, value: unknown): ValidationResult {
  const validate = validatorFor(schema)
  const valid = validate(value) as boolean
  const errors = (validate.errors ?? []).map((error) => `${error.instancePath || '/'} ${describe(error)}`)
  return { valid, errors }
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

/** Each circle in a set of links, as the ids along it: `['a', 'b', 'a']` when a links to b and b to a. */
function circles(links: Map<string, string[]>): string[][] {
  const found: string[][] = []
  const settled = new Set<string>()
  const path: string[] = []
  const walk = (id: string): void => {
    const at = path.indexOf(id)
    if (at !== -1) {
      found.push([...path.slice(at), id])
      return
    }
    if (settled.has(id)) return
    path.push(id)
    for (const next of links.get(id) ?? []) walk(next)
    path.pop()
    settled.add(id)
  }
  for (const id of links.keys()) walk(id)
  return found
}

/**
 * The rules catalogue.schema.yaml states in words, which a JSON Schema cannot hold: an id or a slug is listed once, a
 * link names something the catalogue lists, an entry's home is one of its subjects, and no chain of links comes back
 * to where it started.
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
    const seen = new Set<string>()
    entry.subjects.forEach((id, at) => {
      if (seen.has(id)) errors.push(`/entries/${index}/subjects/${at} is listed twice: ${quote(id)}`)
      else if (!subjectAt.has(id)) {
        errors.push(`/entries/${index}/subjects/${at} names a subject the catalogue does not list: ${quote(id)}`)
      }
      seen.add(id)
    })
    if (!seen.has(entry.home)) {
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

/** Checks a parsed blocks index against blocks-index.schema.yaml. */
export function validateBlocksIndex(index: unknown): ValidationResult {
  return check(blocksIndexSchema, index)
}
