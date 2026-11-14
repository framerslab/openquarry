// What a reader built on @framers/openquarry 0.2.0 holds, for the tests that prove 0.3.0's files still read there.
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

/** The SHA-256 of each schema file in 0.2.0, from that version's schema/SOURCE.json. */
export const AT_0_2_0: Record<string, string> = {
  'blocks-index.schema.yaml': '78bf128adb172d522333fc89e47fe0d89b2b96073e12a0671c3587bf4b87bea2',
  'fabric.schema.yaml': '290ee1b0eed8debaf1ff458cf94806bd9bb8eaf0dacd5cd2bfdab15690de9b8a',
  'loom.schema.yaml': '761e668f0ebb52ccf34d6833ee466ac556d000b1fbfa2f95bcb0174450fecc9e',
  'strand.schema.yaml': 'f6f217484f03793046861d8b152804382eeba58f98c49cae3a8560bb55e34ce8',
  'thread.schema.yaml': '1af37f95bb61532c102ab2a30c0250a6e2375afe20228dd1b50b40c17e28e766',
  'weave.schema.yaml': 'a37d65837e73f6a72ac2bec5746a9db8724d25c500e4c1c6dc89d10444197b29',
}

/** A schema file with its top-level `kind` property taken out: the `  kind:` line and the lines indented under it. */
export function withoutKind(text: string): string {
  const kept: string[] = []
  let inside = false
  for (const line of text.split('\n')) {
    if (line.startsWith('  kind:')) {
      inside = true
    } else if (!(inside && line.startsWith('    '))) {
      inside = false
      kept.push(line)
    }
  }
  return kept.join('\n')
}

/**
 * The validator a 0.2.0 reader holds for a weave or a loom: today's schema without `kind`. test/compat.test.ts holds
 * that schema to the bytes 0.2.0 shipped.
 */
export function readerAt020(schema: Record<string, unknown>): (value: unknown) => boolean {
  const { kind: _kind, ...properties } = schema.properties as Record<string, unknown>
  const ajv = new Ajv2020({ allErrors: true, strict: false })
  addFormats(ajv)
  const validate = ajv.compile({ ...schema, properties })
  return (value) => validate(value) as boolean
}
