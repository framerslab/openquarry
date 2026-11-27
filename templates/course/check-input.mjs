import { closeSync, constants, fstatSync, openSync, readFileSync } from 'node:fs'
import { blocksIndexSchema, validateFabricManifest } from '@framers/openquarry'

// Open once without waiting for a writer and read only if the same handle is a plain file.
export function readPlain(path) {
  let fd
  try {
    fd = openSync(path, constants.O_RDONLY | (constants.O_NONBLOCK ?? 0))
  } catch (error) {
    if (['ENOENT', 'ENOTDIR', 'ELOOP', 'ENXIO'].includes(error.code)) return undefined
    throw error
  }
  try {
    return fstatSync(fd).isFile() ? readFileSync(fd, 'utf8').replace(/^\uFEFF/, '') : undefined
  } finally {
    closeSync(fd)
  }
}

const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value)

// An older library understands the legacy keys. Project each spelling to those keys and, when both were present,
// validate the two projections so an invalid value under either spelling is still reported.
function projectIndex(index, preferCurrent, fields) {
  if (!isRecord(index)) return index
  const project = (record, current, legacy, label = current) => {
    if (!isRecord(record)) return record
    const hasLegacy = Object.hasOwn(record, legacy)
    if (hasLegacy) fields.add(label)
    if (Object.hasOwn(record, current) && (preferCurrent || !hasLegacy)) {
      return { ...record, [legacy]: record[current] }
    }
    return record
  }
  const projected = { ...project(index, 'threads', 'strands') }
  projected.stats = project(index.stats, 'totalThreads', 'totalStrands', 'stats.totalThreads')
  if (isRecord(index.tagIndex)) {
    projected.tagIndex = Object.fromEntries(Object.entries(index.tagIndex).map(([tag, entries]) => [
      tag,
      Array.isArray(entries)
        ? entries.map((entry) => project(entry, 'threadPath', 'strandPath', 'tagIndex[].threadPath'))
        : entries,
    ]))
  }
  return projected
}

function withWarnings(result, fields) {
  return result.valid && fields.size
    ? { ...result, warnings: [`Deprecated fields: use ${[...fields].join(', ')}.`] }
    : result
}

export function checkThreadFields(value, validate) {
  if (Object.hasOwn(blocksIndexSchema.properties, 'threads')) return validate(value, { normalize: true })

  const fields = new Set()
  if (validate === validateFabricManifest) {
    const result = validate(value)
    if (!result.valid) return result
    for (const [legacy, current] of [['strand', 'thread'], ['strands', 'threads'], ['strandPath', 'threadPath']]) {
      if (Object.hasOwn(value, legacy)) fields.add(current)
    }
    return withWarnings(result, fields)
  }

  const current = validate(projectIndex(value, true, fields))
  if (!current.valid || !fields.size) return current
  return withWarnings(validate(projectIndex(value, false, fields)), fields)
}
