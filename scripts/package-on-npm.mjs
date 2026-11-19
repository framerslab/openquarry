// Is a package on npm ours? CI runs the openquarry command from npm only after this says yes, so a package someone
// else published under the name is never run.
// "Ours" is read from what the registry itself records, not from what a publisher writes into a package:
//   - every maintainer of the package is one of our npm accounts;
//   - the newest version's provenance attestation, which the registry verified when the version was published, says the
//     version was built from this repository by the release workflow.
// The repository address in the package's own manifest is checked too, as a third reading.

export const maintainers = ['jdunnfive', 'manicteam']
export const source = { repository: 'https://github.com/framerslab/openquarry', workflow: '.github/workflows/release.yml' }

/**
 * Asks the registry about a package. Returns `{ version: undefined }` when npm has no package of that name, and
 * `{ version }` (its newest version) when the package is ours. Throws, naming what is wrong, when the name belongs to
 * someone else, when the newest version carries no provenance from this repository's release workflow, or when the
 * registry cannot be read.
 */
export async function packageOnNpm(name, request = fetch) {
  const registry = 'https://registry.npmjs.org'
  const path = name.replace('/', '%2f')
  const answer = await request(`${registry}/${path}`)
  if (answer.status === 404) return { version: undefined }
  if (!answer.ok) throw Error(`The npm registry answered ${answer.status} for ${name}`)
  const doc = await answer.json()
  const version = doc['dist-tags']?.latest
  if (typeof version !== 'string' || !doc.versions?.[version]) throw Error(`The npm registry names no newest version of ${name}`)

  const names = (doc.maintainers ?? []).map((maintainer) => maintainer?.name)
  if (names.length === 0 || names.some((maintainer) => !maintainers.includes(maintainer))) {
    throw Error(`The name ${name} on npm belongs to someone else: its maintainers are ${names.join(', ') || 'not listed'}. Nothing from it was run.`)
  }
  const address = String(doc.versions[version].repository?.url ?? '')
  if (!/^(git\+)?https:\/\/github\.com\/framerslab\/openquarry(\.git)?$/.test(address)) {
    throw Error(`${name}@${version} on npm names the repository ${JSON.stringify(address)}, not this one. Nothing from it was run.`)
  }

  const attested = await request(`${registry}/-/npm/v1/attestations/${path}@${version}`)
  if (!attested.ok) throw Error(`${name}@${version} on npm has no provenance attestation (the registry answered ${attested.status}). Nothing from it was run.`)
  const statements = ((await attested.json()).attestations ?? []).map((attestation) => {
    try {
      return JSON.parse(Buffer.from(attestation.bundle.dsseEnvelope.payload, 'base64').toString('utf8'))
    } catch {
      return {}
    }
  })
  const provenance = statements.find((statement) => statement.predicateType === 'https://slsa.dev/provenance/v1')
  const subject = provenance?.subject?.[0]?.name
  const workflow = provenance?.predicate?.buildDefinition?.externalParameters?.workflow
  if (subject !== `pkg:npm/${name.replace('@', '%40')}@${version}` || workflow?.repository !== source.repository || workflow?.path !== source.workflow) {
    throw Error(`${name}@${version} on npm was not built by ${source.workflow} of ${source.repository}: its provenance names ${JSON.stringify(workflow ?? null)} for ${JSON.stringify(subject ?? null)}. Nothing from it was run.`)
  }
  return { version }
}
