# Proposal: remove compatibility names in 1.0.0

This is a migration proposal, not a removal in 0.3.0. This site change preserves the package API and every schema address.

Before a major release, inventory each consumer: Quarry readers, writers, import/export and local stores; Quarry School's content tooling; the Frame Codex corpus and schema sync; downstream TypeScript imports; and third-party tools using the published schemas. The server SDK is separate and needs its own compatibility assessment. Confirm ownership and migration completion for each consumer before setting a release date. This list identifies integration surfaces, not a claim that every deployment has been audited.

1. Change the schema source repository, framerslab/codex, first. Decide the new stored level value, manifest version and migration contract there. Sync the approved sources and hashes with this repository's existing workflow; regenerate the exported schema objects in CI.
2. Migrate consumers from `StrandFrontmatter` to `ThreadFrontmatter` and from `strandSchema` to `threadSchema`. Inventory deprecated aliases in `src/types.ts` and all imports before removing exports. Add compile fixtures for the supported API and release notes describing every removed symbol.
3. Migrate the persisted `strand` level value in `KnowledgeNodeType`. Merely renaming a TypeScript type does not change stored records. Readers need dual-read support during migration; writers use the new value only after storage and consumers are ready. Back up stores, migrate transactionally and retain rollback information.
4. Inventory version 1 fabrics, including those without manifests. Provide a dry-run migrator for `looms/` and `strands/` folder prefixes that detects collisions, preserves UUIDs and rewrites affected paths and links. Keep a compatibility importer for older content; reject unsupported versions explicitly.
5. Remove `strand.schema.yaml` from a future package only after consumer migration. Keep the published `/schema/v1/strand.schema.json` and YAML URLs indefinitely as immutable historical schemas. Introduce a new versioned schema namespace for changed semantics; never overwrite v1.
6. Test migrated and unmigrated fixtures, reader/writer interoperability, link resolution, conflicts and rollback in CI. Review dependent repositories before publishing a major release manually.

No npm release or schema sync is part of this site change.
