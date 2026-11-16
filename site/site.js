// The theme switch and the copy keys on code blocks. Both stay hidden until this script runs.
const toggle = document.querySelector('[data-theme-toggle]')
if (toggle) {
  const isDark = () => document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches)
  const label = () => toggle.setAttribute('aria-label', isDark() ? 'Switch to the light look' : 'Switch to the dark look')
  toggle.hidden = false
  label()
  toggle.addEventListener('click', () => {
    const theme = isDark() ? 'light' : 'dark'
    document.documentElement.dataset.theme = theme
    try { localStorage.setItem('theme', theme) } catch {}
    label()
  })
}

const status = document.createElement('p')
status.className = 'sr-only'
status.setAttribute('role', 'status')
document.body.append(status)
for (const button of document.querySelectorAll('[data-copy]')) {
  button.hidden = false
  button.addEventListener('click', async () => {
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
  })
}
