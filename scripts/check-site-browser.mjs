// CI only: inspect generated pages at narrow and wide viewports.
import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { readFileSync, existsSync, statSync, mkdirSync } from 'node:fs'
import { resolve, extname } from 'node:path'
const root = resolve('dist-site/site')
const server = createServer((req,res)=>{
  let path=resolve(root, '.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname))
  if (!path.startsWith(root+'/') && path!==root) {res.writeHead(403).end();return}
  if (existsSync(path) && statSync(path).isDirectory()) path+='/index.html'
  if(!existsSync(path)){res.writeHead(404).end();return}
  res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.ttf':'font/ttf','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webmanifest':'application/manifest+json'})[extname(path)]||'application/octet-stream')
  res.end(readFileSync(path))
})
await new Promise(r=>server.listen(4173,'127.0.0.1',r))
const browser=await chromium.launch()
// The icons, the manifest and the share image the pages name in their heads.
for(const asset of ['icon.svg','favicon.ico','apple-touch-icon.png','icon-192.png','icon-512.png','manifest.webmanifest','og.png','site.js','robots.txt','sitemap.xml']) if(!existsSync(resolve(root,asset)))throw Error('Missing '+asset)
mkdirSync('site-screenshots',{recursive:true})
try {
for(const width of [320,390,1440]) for(const theme of ['light','dark']) {
 const page=await browser.newPage({viewport:{width,height:1000},colorScheme:theme})
 for(const route of ['','format/','courses/','llm/','schema/','validate/','spiral/','about/']) {
  const response=await page.goto('http://127.0.0.1:4173/'+route)
  if(response.status()!==200) throw Error('Missing '+route)
  await page.evaluate(()=>document.fonts.ready)
  const issues=await page.evaluate(()=>{
   const errors=[]
   if(document.documentElement.scrollWidth>innerWidth)errors.push('page overflow')
   // Every row of links stays one row at every width: it scrolls sideways instead of wrapping.
   if(document.querySelectorAll('header nav[aria-label=Main] a').length<5)errors.push('the main navigation is missing')
   for(const nav of document.querySelectorAll('nav')){const tops=[...nav.querySelectorAll('a')].map(a=>Math.round(a.getBoundingClientRect().top));if(new Set(tops).size>1)errors.push('navigation wraps: '+nav.getAttribute('aria-label'))}
   if(!document.querySelector('header a[href="https://github.com/framerslab/openquarry"]'))errors.push('no GitHub key in the header')
   // The brand, the GitHub key and the theme switch share the header's first row at every width.
   const firstRow=['.top .brand','.gh-key','[data-theme-toggle]'].map(s=>document.querySelector(s)).filter(e=>e&&!e.hidden).map(e=>{const r=e.getBoundingClientRect();return Math.round(r.top+r.height/2)})
   if(Math.max(...firstRow)-Math.min(...firstRow)>4)errors.push('header first row wraps')
   for(const el of document.querySelectorAll('p, a, code, button, li, td')) if(parseFloat(getComputedStyle(el).fontSize)<14)errors.push('small type')
   const luminance=c=>{const v=c.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return v[0]*.2126+v[1]*.7152+v[2]*.0722}
   const s=getComputedStyle(document.body),a=luminance(s.color),b=luminance(s.backgroundColor)
   if((Math.max(a,b)+.05)/(Math.min(a,b)+.05)<12)errors.push('body contrast below 12:1')
   return errors
  })
  // A failing page is captured before the check stops, so the screenshots artifact shows it.
  if(issues.length){await page.screenshot({path:`site-screenshots/failed-${width}-${theme}-${route.replace('/','')||'home'}.png`,fullPage:true,animations:'disabled'});throw Error(`${width} ${theme} ${route}: ${issues.join(', ')}`)}
  if(!route)await page.screenshot({path:`site-screenshots/landing-${width}-${theme}.png`,fullPage:true,animations:'disabled'})
  // Every same-site link: root-relative, relative, and absolute ones on the canonical origin (the schema list writes
  // https://openquarry.dev/schema/v1/...), each requested from this build, never from the deployed host.
  const hrefs=await page.locator('a[href]').evaluateAll(as=>as.map(a=>a.href))
  for(const href of new Set(hrefs)){
   const u=new URL(href); u.hash=''
   if(u.origin==='https://openquarry.dev'){u.protocol='http:';u.host='127.0.0.1:4173'}
   else if(u.origin!=='http://127.0.0.1:4173')continue
   const r=await page.request.get(u.href);if(!r.ok())throw Error(`Broken link ${href} on /${route}`)
  }
 }
 await page.goto('http://127.0.0.1:4173/')
 // The copy key on a code block copies the code and says so.
 await page.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:'http://127.0.0.1:4173'})
 const copy=page.locator('.check [data-copy]')
 await copy.click()
 // The clipboard write is asynchronous: wait for the key to say how it went, then read the clipboard back.
 await page.waitForFunction(()=>document.querySelector('.check [data-copy]').textContent!=='Copy',null,{timeout:5000})
 if(await copy.textContent()!=='Copied')throw Error('The copy key did not copy: '+await copy.textContent())
 const copied=await page.evaluate(()=>navigator.clipboard.readText())
 if(copied!==await page.locator('.check pre code').textContent())throw Error('The clipboard does not hold the code')
 await page.locator('[data-theme-toggle]').click()
 await page.reload()
 if(await page.locator('html').getAttribute('data-theme')!==(theme==='dark'?'light':'dark'))throw Error('Theme did not persist')
 await page.close()
}
} finally {await browser.close();server.close()}
