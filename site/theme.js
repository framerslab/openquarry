const button = document.querySelector('[data-theme-toggle]')
button.hidden = false
button.addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches)
  const theme = dark ? 'light' : 'dark'
  document.documentElement.dataset.theme = theme
  try { localStorage.setItem('theme', theme) } catch {}
  button.setAttribute('aria-label', `Switch to ${dark ? 'dark' : 'light'} theme`)
})
