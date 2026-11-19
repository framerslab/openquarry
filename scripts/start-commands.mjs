// The starters under templates/ and the commands that start a project from one: copy the folder with degit, install,
// and check every file. The package page and the README show these commands; CI runs them in a fresh folder against
// the package from npm (scripts/check-start-commands.mjs), and a test holds the README's copy to this one.

export const repository = 'framerslab/openquarry'

export const starters = [
  {
    id: 'notes',
    title: 'Notes',
    folder: 'templates/notes',
    dest: 'my-notes',
    text: 'A knowledge base: one weave of notes, a loom and a first note.',
  },
  {
    id: 'course',
    title: 'A course',
    folder: 'templates/course',
    dest: 'my-course',
    text: 'A weave of kind <code>course</code>, a loom of kind <code>unit</code> and a first lesson.',
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

/** Prints a new id for a note or a lesson. */
export const newId = 'node -e "console.log(crypto.randomUUID())"'
