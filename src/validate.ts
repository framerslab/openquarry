import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'
import type { ValidateFunction } from 'ajv'
import { blocksIndexSchema, fabricSchema, loomSchema, threadSchema, weaveSchema } from './schemas.js'

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

function check(schema: Record<string, unknown>, value: unknown): ValidationResult {
  const validate = validatorFor(schema)
  const valid = validate(value) as boolean
  const errors = (validate.errors ?? []).map((error) => `${error.instancePath || '/'} ${error.message ?? 'is invalid'}`)
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

/** Checks a parsed blocks index against blocks-index.schema.yaml. */
export function validateBlocksIndex(index: unknown): ValidationResult {
  return check(blocksIndexSchema, index)
}
