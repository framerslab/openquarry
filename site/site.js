// The theme switch, the menu and the copy keys on code blocks. The switch and the copy keys stay hidden until this script runs.
const toggles = [...document.querySelectorAll('[data-theme-toggle]')]
const isDark = () => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches)
const label = () => {
  const text = isDark() ? 'Switch to the light look' : 'Switch to the dark look'
  for (const toggle of toggles) {
    const words = toggle.querySelector('span')
    if (words) words.textContent = text
    else toggle.setAttribute('aria-label', text)
  }
}
for (const toggle of toggles) {
  toggle.hidden = false
  toggle.addEventListener('click', () => {
    const theme = isDark() ? 'light' : 'dark'
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('theme', theme) } catch {}
    label()
  })
}
label()

// The menu opens without this script (it is a <details>). The script closes it on Escape, on a press outside it and when
// the keyboard leaves it.
const menu = document.querySelector('.menu')
if (menu) {
  const key = menu.querySelector('summary')
  document.addEventListener('click', (event) => { if (menu.open && !menu.contains(event.target)) menu.open = false })
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !menu.open) return
    menu.open = false
    key.focus()
  })
  menu.addEventListener('focusout', (event) => { if (menu.open && event.relatedTarget && !menu.contains(event.relatedTarget)) menu.open = false })
}

const status = document.createElement('p')
status.className = 'sr-only'
status.setAttribute('role', 'status')
document.body.append(status)
// Clipboard writes run one after another in click order, so an earlier copy never lands after a later one.
let queue = Promise.resolve()
for (const button of document.querySelectorAll('[data-copy]')) {
  button.hidden = false
  button.addEventListener('click', () => { queue = queue.then(() => copy(button)) })
}
async function copy(button) {
    const text = button.closest('.code').querySelector('code').textContent
    let done = false
    try { await navigator.clipboard.writeText(text); done = true } catch {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.className = 'sr-only'
      document.body.append(area)
      area.select()
      try { done = document.execCommand('copy') } catch {}
      area.remove()
    }
    button.textContent = done ? 'Copied' : 'Copy failed'
    status.textContent = done ? 'Code copied' : 'Copy failed'
    clearTimeout(button.timer)
    button.timer = setTimeout(() => { button.textContent = 'Copy' }, 1800)
}

// On a narrow screen the row of guides scrolls: bring the current guide into view.
const current = document.querySelector('.docs-nav [aria-current=page]')
if (current) {
  const row = current.parentElement
  const shift = current.getBoundingClientRect().left - row.getBoundingClientRect().left - (row.clientWidth - current.offsetWidth) / 2
  if (row.scrollWidth > row.clientWidth) row.scrollLeft += shift
}
