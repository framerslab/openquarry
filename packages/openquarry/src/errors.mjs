// The two ways a command stops without doing its work. The command line prints each as one line on standard error.

/** The command ran and will not go on: a folder that is not empty, a file already there, a path that leads out. Exit 1. */
export class Refusal extends Error {}

/** The command line itself is wrong: an unknown command or option, a missing argument. Exit 2. */
export class UsageError extends Error {}
