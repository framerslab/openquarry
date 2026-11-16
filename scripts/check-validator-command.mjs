// CI only: exercise the exact documented API command on valid and invalid input.
import { command } from './site-pages.mjs'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, rmSync } from 'node:fs'
const path = 'scale-and-distance.md'
const valid = readFileSync('examples/reading-a-map/weaves/reading-a-map/the-map/scale-and-distance.md','utf8')
const invocation = command.slice(command.indexOf('node --input-type'))
try {
 writeFileSync(path, valid)
 execFileSync('sh',['-c',invocation],{stdio:'inherit'})
 for(const text of [valid.replace('contentType: lesson','contentType: lecture'), 'No frontmatter', '---\ninvalid: [\n---\n']) {
  writeFileSync(path,text)
  let failed=false
  try {execFileSync('sh',['-c',invocation],{stdio:'pipe'})} catch {failed=true}
  if(!failed)throw Error('Documented command accepted invalid input')
 }
} finally {rmSync(path,{force:true})}
