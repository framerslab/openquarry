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
  res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.ttf':'font/ttf'})[extname(path)]||'application/octet-stream')
  res.end(readFileSync(path))
})
await new Promise(r=>server.listen(4173,'127.0.0.1',r))
const browser=await chromium.launch()
mkdirSync('site-screenshots',{recursive:true})
try {
for(const width of [320,390,1440]) for(const theme of ['light','dark']) {
 const page=await browser.newPage({viewport:{width,height:1000},colorScheme:theme})
 for(const route of ['','format/','courses/','llm/','schema/','validate/','spiral/']) {
  const response=await page.goto('http://127.0.0.1:4173/'+route)
  if(response.status()!==200) throw Error('Missing '+route)
  await page.evaluate(()=>document.fonts.ready)
  const issues=await page.evaluate(()=>{
   const errors=[]
   if(document.documentElement.scrollWidth>innerWidth)errors.push('page overflow')
   const links=[...document.querySelectorAll('nav a')]
   if(new Set(links.map(a=>a.offsetTop)).size!==1)errors.push('navigation wraps')
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
 await page.locator('[data-theme-toggle]').click()
 await page.reload()
 if(await page.locator('html').getAttribute('data-theme')!==(theme==='dark'?'light':'dark'))throw Error('Theme did not persist')
 await page.close()
}
} finally {await browser.close();server.close()}
