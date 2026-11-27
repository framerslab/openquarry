import { closeSync, constants, fstatSync, openSync, readFileSync } from 'node:fs'
import { blocksIndexSchema, validateBlocksIndex } from '@framers/openquarry'

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
function projectIndex(index, preferCurrent, fields, projectedPaths) {
  if (!isRecord(index)) return index
  const project = (record, current, legacy, location = '', label = current) => {
    if (!isRecord(record)) return record
    const hasLegacy = Object.hasOwn(record, legacy)
    if (hasLegacy) fields.add(label)
    if (Object.hasOwn(record, current) && (preferCurrent || !hasLegacy)) {
      projectedPaths.set(`${location}/${legacy}`, `${location}/${current}`)
      return { ...record, [legacy]: record[current] }
    }
    return record
  }
  const projected = { ...project(index, 'threads', 'strands') }
  projected.stats = project(index.stats, 'totalThreads', 'totalStrands', '/stats', 'stats.totalThreads')
  if (isRecord(index.tagIndex)) {
    projected.tagIndex = Object.fromEntries(Object.entries(index.tagIndex).map(([tag, entries]) => {
      const pointer = `/tagIndex/${tag.replaceAll('~', '~0').replaceAll('/', '~1')}`
      const references = Array.isArray(entries)
        ? entries.map((entry, offset) => {
          return project(entry, 'threadPath', 'strandPath', `${pointer}/${offset}`, 'tagIndex[].threadPath')
        })
        : entries
      return [tag, references]
    }))
  }
  return projected
}

function withWarnings(result, fields) {
  return result.valid && fields.size
    ? { ...result, warnings: [`Deprecated fields: use ${[...fields].join(', ')}.`] }
    : result
}

export function checkBlocksIndex(value) {
  if (Object.hasOwn(blocksIndexSchema.properties, 'threads')) return validateBlocksIndex(value, { normalize: true })

  const fields = new Set()
  const projectedErrors = /^\/(?:strands(?=\/| )|stats\/totalStrands(?= )|tagIndex\/[^/]*\/\d+\/strandPath(?= ))/
  const checkProjection = (preferCurrent) => {
    const paths = new Map()
    const result = validateBlocksIndex(projectIndex(value, preferCurrent, fields, paths))
    if (result.valid) return result
    return { ...result, errors: result.errors.map((line) => line.replace(projectedErrors, (path) => paths.get(path) ?? path)) }
  }
  const current = checkProjection(true)
  if (!current.valid || !fields.size) return current
  return withWarnings(checkProjection(false), fields)
}
