// The theme switch, the menu, the copy keys on code blocks and the arrow keys of the guides' row. The switch and the copy keys stay hidden until this script runs.
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

// The guides' row. When its tabs do not fit, a previous and a next key show at the ends of the strip. A press moves
// the strip by about one view: Next brings the first tab the right edge cuts to the left edge, whole, and Previous the
// last tab the left edge cuts to the right edge. A key is inactive at its end (aria-disabled, so it keeps the
// keyboard's focus). The move is the browser's smooth scroll, and a jump when the reader asks for reduced motion.
const guides = document.querySelector('.docs-nav')
const strip = guides && guides.querySelector('.docs-tabs')
if (strip) {
  const prev = guides.querySelector('[data-tabs-prev]')
  const next = guides.querySelector('[data-tabs-next]')
  const calm = matchMedia('(prefers-reduced-motion: reduce)')
  // The strip's fade at an edge with tabs beyond it (style.css): a tab brought to an edge sits clear of it.
  const fade = 28
  const end = () => strip.scrollWidth - strip.clientWidth
  const update = () => {
    // The keys show only when the tabs need more room than the row has without the keys.
    const style = getComputedStyle(guides)
    const room = guides.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    const over = strip.scrollWidth > room + 1
    prev.hidden = next.hidden = !over
    const atStart = strip.scrollLeft <= 1
    const atEnd = strip.scrollLeft >= end() - 1
    prev.setAttribute('aria-disabled', String(!over || atStart))
    next.setAttribute('aria-disabled', String(!over || atEnd))
    guides.dataset.scroll = !over ? 'none' : atStart ? 'start' : atEnd ? 'end' : 'middle'
  }
  // Where a press is taking the strip while its scroll is still running, so a second press goes on from there.
  let goal = null
  let settled
  // Once the reader has moved the strip, it is never put back under them.
  let touched = false
  for (const type of ['pointerdown', 'touchstart', 'wheel', 'keydown']) strip.addEventListener(type, () => { touched = true }, { passive: true })
  const move = (direction) => {
    touched = true
    const box = strip.getBoundingClientRect()
    const from = goal ?? strip.scrollLeft
    const width = strip.clientWidth
    // Each tab's left and right edge, measured along the strip's whole length.
    const edges = [...strip.querySelectorAll('a')].map((tab) => {
      const r = tab.getBoundingClientRect()
      return [r.left - box.left + strip.scrollLeft, r.right - box.left + strip.scrollLeft]
    })
    let to
    if (direction > 0) {
      const cut = edges.find(([, right]) => right > from + width + 0.5)
      to = cut ? cut[0] - fade : end()
      // A tab wider than the view: move on by most of a view.
      if (to < from + 8) to = from + width * 0.8
    } else {
      const cut = edges.filter(([left]) => left < from - 0.5).pop()
      to = cut ? cut[1] + fade - width : 0
      if (to > from - 8) to = from - width * 0.8
    }
    to = Math.max(0, Math.min(end(), Math.round(to)))
    goal = to
    clearTimeout(settled)
    settled = setTimeout(() => { goal = null }, 700)
    strip.scrollTo({ left: to, behavior: calm.matches ? 'auto' : 'smooth' })
  }
  for (const [key, direction] of [[prev, -1], [next, 1]]) {
    key.addEventListener('click', () => { if (key.getAttribute('aria-disabled') !== 'true') move(direction) })
  }
  strip.addEventListener('scroll', update, { passive: true })
  strip.addEventListener('scrollend', () => { goal = null })
  addEventListener('resize', update)
  // The strip opens with the current guide's tab in the middle, set in place with no animation.
  const place = () => {
    update()
    const current = strip.querySelector('[aria-current=page]')
    if (current && strip.scrollWidth > strip.clientWidth) {
      strip.scrollLeft += current.getBoundingClientRect().left - strip.getBoundingClientRect().left - (strip.clientWidth - current.offsetWidth) / 2
    }
    update()
  }
  place()
  // The tabs change width when the site's font arrives.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => (touched ? update() : place()))
}
