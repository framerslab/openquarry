// The starters under templates/ and the commands that start a project from one. The package page and the README show
// these commands, and a test holds the README's copy to this one.
// - With the openquarry command (packages/openquarry): init, check, new and id. CI packs the command, installs the
//   tarball into an empty folder and runs these lines (scripts/check-cli.mjs).
// - With degit: copy the folder, install, and check every file. CI runs these in a fresh folder against the package
//   from npm (scripts/check-start-commands.mjs).

export const repository = 'framerslab/openquarry'

export const starters = [
  {
    id: 'notes',
    title: 'Notes',
    folder: 'templates/notes',
    dest: 'my-notes',
    text: 'Makes a knowledge base with a fabric manifest, one weave, one loom and a first note.',
  },
  {
    id: 'course',
    title: 'A course',
    folder: 'templates/course',
    dest: 'my-course',
    text: 'Makes a course with a weave of kind <code>course</code>, a loom of kind <code>unit</code> and a first lesson.',
  },
]

/** The commands for a starter. `ref` pins the copy to a commit, and `from` names the repository that holds it: CI on a
 * pull request copies the pull request's own head from the repository it comes from, a fork included, since the
 * documented source names this repository's default branch. */
export function startCommands(starter, ref, from = repository) {
  return [
    `npx degit ${from}/${starter.folder}${ref ? `#${ref}` : ''} ${starter.dest}`,
    `cd ${starter.dest}`,
    'npm install',
    'npm run check',
  ].join('\n')
}

/** Prints a new id for a note or a lesson with Node alone. The starters' READMEs show it, and the start job runs it. */
export const newId = 'node -e "console.log(crypto.randomUUID())"'

/** The commands that start a project with the openquarry command: one line makes the folder, the next two check it. */
export function initCommands(starter) {
  return [`npx openquarry init ${starter.dest}${starter.id === 'notes' ? '' : ` --template ${starter.id}`}`, `cd ${starter.dest}`, checkCommand].join('\n')
}

/** Checks every file of the project in the current folder. */
export const checkCommand = 'npx openquarry check'

/** Adds a note or a lesson to a starter's first folder, by the starter's id. */
export const newCommands = {
  notes: 'npx openquarry new note "Scale and distance" --in weaves/notes/getting-started',
  course: 'npx openquarry new lesson "Reading contour lines" --in weaves/my-course/first-unit',
}

/** Prints a new id with the openquarry command. */
export const idCommand = 'npx openquarry id'

/** The documented lines with each `npx openquarry` pinned to one version. CI runs them so against npm, on the version whose
 * maintainers and provenance it has just read: a published version never changes. */
export const pinnedTo = (version, lines) => lines.replaceAll('npx openquarry ', `npx openquarry@${version} `)

/**
 * Shown above the openquarry commands, in the README and on the package page, until the openquarry package is on npm.
 * After the release, set this to null and remove the sentence from the README: the tests hold both to this value, and
 * CI's start job warns while the sentence is still shown after npm serves the package.
 * The sentence gives readers no test of their own (such as a version number npm prints): anyone could publish a package
 * under a free name at any version, so the only signal is the note itself, which the release removes.
 */
export const beforeRelease = null
