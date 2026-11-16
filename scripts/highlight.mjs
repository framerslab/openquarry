// Syntax highlighting for the site's code blocks, done once at build time: no script in the browser and no outside
// host. Each language is a small line or character scanner that wraps tokens in <span class="t-…">. The text inside the
// spans is the source, escaped, so a block's textContent is exactly the code (the copy key copies that).
//   key  a YAML key, a JavaScript keyword, a shell command, a Markdown heading
//   str  a quoted string, a YAML scalar after a key, a regular expression
//   lit  a number, true, false, null
//   com  a comment, a file-tree label
//   pun  the YAML document markers, list dashes, colons, brackets
// A CR is written as a character reference: an HTML parser would turn a bare one into a line feed, and the copy key
// would then copy a different file.
export const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll('\r', '&#13;')
const tok = (kind, s) => (s ? `<span class="t-${kind}">${esc(s)}</span>` : '')

const LANGS = { yaml: 'YAML', yml: 'YAML', markdown: 'Markdown', md: 'Markdown', ts: 'TypeScript', typescript: 'TypeScript', js: 'JavaScript', javascript: 'JavaScript', json: 'JSON', bash: 'Shell', sh: 'Shell', shell: 'Shell', text: 'Text', tree: 'Files' }
export const languageName = (lang) => LANGS[(lang || '').toLowerCase()] || 'Text'

// A YAML scalar: quoted string, literal, flow list or plain text, with a trailing comment.
function scalar(value) {
  if (!value) return ''
  const comment = /(\s+#.*)$/.exec(value)
  let body = comment ? value.slice(0, comment.index) : value
  let out
  if (/^(true|false|null|~|-?\d+(\.\d+)?)$/.test(body.trim())) out = tok('lit', body)
  else if (/^\[.*\]$|^\{.*\}$/.test(body.trim())) out = body.split(/([[\]{},])/).map((part) => (/^[[\]{},]$/.test(part) ? tok('pun', part) : part.trim() ? tok('str', part) : esc(part))).join('')
  else if (/^[|>][-+]?\d*$/.test(body.trim())) out = tok('pun', body)
  else out = tok('str', body)
  return out + (comment ? tok('com', comment[1]) : '')
}

export function yamlLines(text) {
  const lines = text.split('\n')
  let block = -1 // the indent of a key whose value is a | or > block; deeper lines are its text
  return lines.map((line) => {
    const indent = /^\s*/.exec(line)[0].length
    if (block >= 0) {
      if (line.trim() === '' || indent > block) return tok('str', line)
      block = -1
    }
    if (/^---\s*$|^\.\.\.\s*$/.test(line)) return tok('pun', line)
    if (/^\s*#/.test(line)) return tok('com', line)
    const m = /^(\s*)(- )?([^\s:#'"][^:#]*?|"[^"]*"|'[^']*')(:)(\s+|$)([^\n]*)$/.exec(line)
    if (m) {
      const [, lead, dash, key, colon, gap, value] = m
      if (/^[|>][-+]?\d*$/.test(value.trim())) block = indent + (dash ? 2 : 0)
      return esc(lead) + tok('pun', dash) + tok('key', key) + tok('pun', colon) + esc(gap) + scalar(value)
    }
    const item = /^(\s*)(- )([^\n]*)$/.exec(line)
    if (item) return esc(item[1]) + tok('pun', item[2]) + scalar(item[3])
    return esc(line)
  }).join('\n')
}

// A Markdown file: its frontmatter as YAML, then headings, list markers and inline code.
function markdownLines(text) {
  const front = /^---\r?\n[\s\S]*?\r?\n---(?=\r?\n|$)/.exec(text)
  const head = front ? yamlLines(front[0]) : ''
  const body = (front ? text.slice(front[0].length) : text).split('\n').map((line) => {
    if (/^#{1,6} /.test(line)) return tok('key', line)
    const lead = /^(\s*)([-*+] |\d+\. )?([^\n]*)$/.exec(line)
    const inline = lead[3].split(/(`[^`]+`)/).map((part) => (part.startsWith('`') && part.endsWith('`') && part.length > 1 ? tok('str', part) : esc(part))).join('')
    return esc(lead[1]) + tok('pun', lead[2] || '') + inline
  }).join('\n')
  return head + body
}

const KEYWORDS = new Set('import export from const let var function return if else throw new await async default true false null undefined typeof of in for while class extends interface type as'.split(' '))

// JavaScript and TypeScript (and JSON): one pass over the characters.
export function scriptLines(text) {
  let out = ''
  let i = 0
  let prev = '' // the last character that was not white space, to tell a regular expression from a division
  while (i < text.length) {
    const rest = text.slice(i)
    let m
    if ((m = /^\/\/[^\n]*/.exec(rest)) || (m = /^\/\*[\s\S]*?\*\//.exec(rest))) { out += tok('com', m[0]); i += m[0].length; continue }
    if ((m = /^'(?:\\.|[^'\\\n])*'|^"(?:\\.|[^"\\\n])*"|^`(?:\\.|[^`\\])*`/.exec(rest))) { out += tok('str', m[0]); i += m[0].length; prev = 'a'; continue }
    if (rest[0] === '/' && (prev === '' || /[(=,:;!&|?{}[\n]/.test(prev)) && (m = /^\/(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n[])+\/[dgimsuy]*/.exec(rest))) { out += tok('str', m[0]); i += m[0].length; prev = 'a'; continue }
    if ((m = /^[A-Za-z_$][\w$]*/.exec(rest))) { out += KEYWORDS.has(m[0]) ? tok(['true', 'false', 'null', 'undefined'].includes(m[0]) ? 'lit' : 'key', m[0]) : esc(m[0]); i += m[0].length; prev = 'a'; continue }
    if ((m = /^\d[\d_.]*/.exec(rest))) { out += tok('lit', m[0]); i += m[0].length; prev = 'a'; continue }
    if (!/\s/.test(rest[0])) prev = rest[0]
    out += esc(rest[0])
    i += 1
  }
  return out
}

// Shell: the command word of each line, flags, strings, comments. A single-quoted program after -e is highlighted as
// JavaScript inside its quotes.
function shellLines(text) {
  let out = ''
  let i = 0
  let start = true // at the start of a command
  let prev = ''
  while (i < text.length) {
    const rest = text.slice(i)
    let m
    if (start && (m = /^[ \t]*#[^\n]*/.exec(rest))) { out += tok('com', m[0]); i += m[0].length; continue }
    if ((m = /^'([^']*)'/.exec(rest))) {
      out += prev === '-e' && m[1].includes('\n') ? tok('pun', "'") + scriptLines(m[1]) + tok('pun', "'") : tok('str', m[0])
      i += m[0].length; start = false; prev = 'str'; continue
    }
    if ((m = /^"(?:\\.|[^"\\])*"/.exec(rest))) { out += tok('str', m[0]); i += m[0].length; start = false; prev = 'str'; continue }
    if ((m = /^\n/.exec(rest))) { out += '\n'; i += 1; start = true; continue }
    if ((m = /^[ \t]+/.exec(rest))) { out += m[0]; i += m[0].length; continue }
    if ((m = /^[^\s'"]+/.exec(rest))) {
      const word = m[0]
      out += start ? tok('key', word) : /^--?[A-Za-z]/.test(word) ? tok('lit', word) : esc(word)
      i += word.length; start = /^(&&|\|\||;|\|)$/.test(word); prev = word; continue
    }
    out += esc(rest[0]); i += 1
  }
  return out
}

// A file tree: the label after two or more spaces is a comment.
function treeLines(text) {
  return text.split('\n').map((line) => {
    const m = /^(.*?\S)(\s{2,})(\S.*)$/.exec(line)
    const name = (s) => s.replace(/([├└│─]+)/g, '\u0000$1\u0001').split(/\u0000|\u0001/).map((part) => (/^[├└│─]+$/.test(part) ? tok('pun', part) : esc(part))).join('')
    return m ? name(m[1]) + esc(m[2]) + tok('com', m[3]) : name(line)
  }).join('\n')
}

export function highlight(text, lang) {
  switch ((lang || '').toLowerCase()) {
    case 'yaml': case 'yml': return yamlLines(text)
    case 'markdown': case 'md': return markdownLines(text)
    case 'ts': case 'typescript': case 'js': case 'javascript': case 'json': return scriptLines(text)
    case 'bash': case 'sh': case 'shell': return shellLines(text)
    case 'tree': return treeLines(text)
    default: return esc(text)
  }
}

/** A code block: a bar with the file name or language and a copy key, then the highlighted code. The text is kept
 * exactly, its final newline included, so the copy key copies the file as it is on disk. `label` may hold markup. */
export function codeBlock(text, lang, label) {
  const name = label || languageName(lang)
  return `<figure class="code"><figcaption class="code-bar"><span class="code-name">${name}</span><button class="copy" type="button" data-copy hidden>Copy</button></figcaption><pre tabindex="0"><code class="language-${esc((lang || 'text').toLowerCase())}">${highlight(text, lang)}</code></pre></figure>`
}
