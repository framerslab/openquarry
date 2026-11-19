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
  res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.js':'text/javascript','.ttf':'font/ttf','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.webmanifest':'application/manifest+json','.json':'application/json','.yaml':'text/yaml'})[extname(path)]||'application/octet-stream')
  res.end(readFileSync(path))
})
await new Promise(r=>server.listen(4173,'127.0.0.1',r))
const browser=await chromium.launch()
// The icons, the manifest and the share image the pages name in their heads.
for(const asset of ['icon.svg','favicon.ico','apple-touch-icon.png','icon-192.png','icon-512.png','manifest.webmanifest','og.png','site.js','robots.txt','sitemap.xml']) if(!existsSync(resolve(root,asset)))throw Error('Missing '+asset)
mkdirSync('site-screenshots',{recursive:true})
const routes=['','format/','courses/','llm/','schema/','validate/','spiral/','learning/','package/','about/']
// What a page must hold at the width it is open at. It runs inside the page, so it uses nothing from this file.
const inspect=()=>{
 const errors=[]
 if(document.documentElement.scrollWidth>innerWidth)errors.push('page overflow')
 // Every row of links stays one row at every width: it scrolls sideways instead of wrapping. Links a width folds
 // into the menu are not in the row and are not measured.
 if(document.querySelectorAll('header nav[aria-label=Main] a').length<5)errors.push('the main navigation is missing')
 for(const nav of document.querySelectorAll('nav:not(.menu-panel)')){const tops=[...nav.querySelectorAll('a')].filter(a=>a.getClientRects().length).map(a=>Math.round(a.getBoundingClientRect().top));if(new Set(tops).size>1)errors.push('navigation wraps: '+nav.getAttribute('aria-label'))}
 if(!document.querySelector('header a[href="https://github.com/framerslab/openquarry"]'))errors.push('no GitHub key in the header')
 // The header is ONE row at every width: every control that shows sits on one centre line inside the page, and the
 // row is no taller than its keys. Below 1280 px the menu key shows; below 1000 px the row's own links are folded away.
 const shows=s=>{const e=document.querySelector(s);return !!e&&e.getClientRects().length>0}
 const row=[...document.querySelectorAll('.top>*')].flatMap(e=>e.matches('.menu')?[e.querySelector('.menu-key')]:[e]).filter(e=>e.getClientRects().length).map(e=>e.getBoundingClientRect())
 if(Math.max(...row.map(r=>r.top+r.height/2))-Math.min(...row.map(r=>r.top+r.height/2))>4)errors.push('the header is more than one row')
 if(document.querySelector('.top').getBoundingClientRect().height>72)errors.push('the header is taller than one row')
 if(row.some(r=>r.left<0||r.right>innerWidth+1))errors.push('a header control leaves the page')
 for(let i=1;i<row.length;i++)if(row[i].left<row[i-1].right-1)errors.push('header controls overlap')
 if(!shows('.top .brand')||!shows('.gh-key'))errors.push('the header lacks its mark or its GitHub key')
 if(shows('.menu-key')!==(innerWidth<1280))errors.push('the menu key shows at the wrong width')
 if(shows('.top .main-nav')!==(innerWidth>=1000))errors.push('the header links show at the wrong width')
 if(innerWidth>=1280&&!shows('.main-nav .used-by'))errors.push('a wide header lacks Used by')
 // The row's links are all in view: none is cut off at the row's edge or scrolled out of it.
 const nav=document.querySelector('.top .main-nav')
 if(nav&&nav.getClientRects().length&&nav.scrollWidth>nav.clientWidth+1)errors.push('the header links are cut off')
 if(!shows('.top>[data-theme-toggle]')&&!document.querySelector('.menu-panel [data-theme-toggle]'))errors.push('no look switch')
 // The keys under a heading never wrap: the outlined keys share one row and no key breaks or clips its label. The
 // hero's four keys are one row from 1280 px and two rows of two below it, all of one width. The badges are one row
 // too; on a narrow screen that row scrolls sideways.
 const top=k=>Math.round(k.getBoundingClientRect().top)
 const keys=[...document.querySelectorAll('.actions .key')].filter(k=>!k.closest('.hero'))
 if(new Set(keys.map(top)).size>1)errors.push('the keys under the heading wrap')
 if(innerWidth<=760&&new Set(keys.map(k=>Math.round(k.getBoundingClientRect().width))).size>1)errors.push('the outlined keys under the heading differ in width')
 const hero=[...document.querySelectorAll('.hero .actions>a')]
 if(hero.length){
  const rows=[];for(const k of hero){const last=rows[rows.length-1];if(last&&last.top===top(k))last.n++;else rows.push({top:top(k),n:1})}
  const want=innerWidth>=1280?[hero.length]:[2,2]
  if(rows.map(r=>r.n).join()!==want.join())errors.push('the hero keys are not in their rows: '+rows.map(r=>r.n).join('+'))
  if(new Set(hero.map(k=>Math.round(k.getBoundingClientRect().width))).size>1)errors.push('the hero keys differ in width')
 }
 for(const k of document.querySelectorAll('.actions > a'))if(k.scrollWidth>k.clientWidth+1||k.getBoundingClientRect().height>56)errors.push('a key does not fit its label')
 const badgeTops=[...document.querySelectorAll('.badges a')].map(top)
 if(new Set(badgeTops).size>1)errors.push('the badges wrap')
 if(location.pathname==='/'&&(!document.querySelector('.hero .actions a[href="https://quarry.school"]')||!document.querySelector('.hero .actions a[href="https://github.com/framerslab/openquarry"]')||!document.querySelector('.hero .actions a[href="/package/"]')||badgeTops.length<3))errors.push('the landing lacks its GitHub key, its Quarry School key, its package key or its badges')
 if(location.pathname==='/'&&!document.querySelector('.install a[href="/package/"]'))errors.push('the landing lacks the install section')
 for(const el of document.querySelectorAll('p, a, code, button, li, td')) if(parseFloat(getComputedStyle(el).fontSize)<14)errors.push('small type')
 const luminance=c=>{const v=c.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>{n/=255;return n<=.04045?n/12.92:((n+.055)/1.055)**2.4});return v[0]*.2126+v[1]*.7152+v[2]*.0722}
 const ratio=(x,y)=>{const a=luminance(x),b=luminance(y);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)}
 const s=getComputedStyle(document.body)
 if(ratio(s.color,s.backgroundColor)<12)errors.push('body contrast below 12:1')
 // Highlighted code: every coloured token reads at 4.5:1 or more on the code block's own background.
 const code=document.querySelector('.code')
 if(code){const bg=getComputedStyle(code).backgroundColor;for(const kind of ['key','str','lit','com','pun']){const t=document.querySelector('.code .t-'+kind);if(t&&ratio(getComputedStyle(t).color,bg)<4.5)errors.push('code colour t-'+kind+' below 4.5:1')}}
 return errors
}
try {
for(const width of [320,390,768,1024,1440]) for(const theme of ['light','dark']) {
 const page=await browser.newPage({viewport:{width,height:1000},colorScheme:theme})
 for(const route of routes) {
  const response=await page.goto('http://127.0.0.1:4173/'+route)
  if(response.status()!==200) throw Error('Missing '+route)
  await page.evaluate(()=>document.fonts.ready)
  const issues=await page.evaluate(inspect)
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
 for(const block of ['.check','.install>div']){
  const copy=page.locator(`${block} [data-copy]`)
  await copy.click()
  // The clipboard write is asynchronous: wait for the key to say how it went, then read the clipboard back.
  await page.waitForFunction(b=>document.querySelector(`${b} [data-copy]`).textContent!=='Copy',block,{timeout:5000})
  if(await copy.textContent()!=='Copied')throw Error('The copy key did not copy: '+await copy.textContent())
  const copied=await page.evaluate(()=>navigator.clipboard.readText())
  if(copied!==await page.locator(`${block} pre code`).textContent())throw Error('The clipboard does not hold the code of '+block)
 }
 // The first command block of Start a project on the package page copies the commands, line for line.
 await page.goto('http://127.0.0.1:4173/package/')
 const startCopy=page.locator('.start [data-copy]').first()
 await startCopy.click()
 await page.waitForFunction(()=>document.querySelector('.start [data-copy]').textContent!=='Copy',null,{timeout:5000})
 if(await startCopy.textContent()!=='Copied')throw Error('The Start a project copy key did not copy: '+await startCopy.textContent())
 const startCopied=await page.evaluate(()=>navigator.clipboard.readText())
 if(startCopied!==await page.locator('.start pre code').first().textContent()||!startCopied.startsWith('npx degit framerslab/openquarry/templates/'))throw Error('The clipboard does not hold the Start a project commands: '+startCopied)
 await page.goto('http://127.0.0.1:4173/')
 // The menu: it opens on its key, holds every link in one column inside the page, and Escape closes it.
 if(width<1280){
  await page.locator('.menu-key').click()
  const panel=await page.evaluate(()=>{const p=document.querySelector('.menu-panel').getBoundingClientRect();const links=[...document.querySelectorAll('.menu-panel a')].map(a=>a.getBoundingClientRect());return {left:p.left,right:p.right,bottom:p.bottom,w:innerWidth,rows:links.filter(r=>r.height>=44).length,columns:new Set(links.map(r=>Math.round(r.left))).size}})
  if(panel.left<0||panel.right>panel.w||panel.rows<9||panel.columns!==1)throw Error(`${width} ${theme}: the menu panel does not fit the page or lacks its links: ${JSON.stringify(panel)}`)
  await page.screenshot({path:`site-screenshots/menu-${width}-${theme}.png`,animations:'disabled'})
  await page.keyboard.press('Escape')
  if(await page.locator('.menu').evaluate(m=>m.open))throw Error('Escape did not close the menu')
 }
 // The look switch: in the header, or in the menu on the narrowest phones.
 if(width<=350){await page.locator('.menu-key').click();await page.locator('.menu-theme').click()}
 else await page.locator('.top>[data-theme-toggle]').click()
 await page.reload()
 if(await page.locator('html').getAttribute('data-theme')!==(theme==='dark'?'light':'dark'))throw Error('Theme did not persist')
 await page.close()
}
// The widths where the header folds (1000 and 1280 px, and one pixel under each) and the widths the pictures of a
// change are taken at: the landing's first screen and the whole package page.
for(const width of [390,999,1000,1279,1280]) for(const theme of ['light','dark']) {
 const page=await browser.newPage({viewport:{width,height:900},colorScheme:theme})
 for(const route of ['','package/']){
  await page.goto('http://127.0.0.1:4173/'+route)
  await page.evaluate(()=>document.fonts.ready)
  const issues=await page.evaluate(inspect)
  if(issues.length){await page.screenshot({path:`site-screenshots/failed-${width}-${theme}-${route.replace('/','')||'home'}.png`,fullPage:true,animations:'disabled'});throw Error(`${width} ${theme} ${route}: ${issues.join(', ')}`)}
  if(width===390||width===1280)await page.screenshot({path:`site-screenshots/${route?'package':'hero'}-${width}-${theme}.png`,fullPage:!!route,animations:'disabled'})
 }
 // The parts a change to Start a project touches, from this build and, where they exist there, from the live site.
 if(width===390||width===1280){
  const parts=[['package/','.start','start'],['package/','.top','package-top'],['','.install','install'],['format/','p.start-link','format-link']]
  for(const [route,selector,name] of parts){
   await page.goto('http://127.0.0.1:4173/'+route);await page.evaluate(()=>document.fonts.ready)
   if(name==='package-top')await page.screenshot({path:`site-screenshots/${name}-${width}-${theme}.png`,animations:'disabled'})
   else await page.locator(selector).first().screenshot({path:`site-screenshots/${name}-${width}-${theme}.png`,animations:'disabled'})
  }
  for(const [route,selector,name] of [['package/',null,'live-package-top'],['','.install','live-install']]){
   try {await page.goto('https://openquarry.dev/'+route,{timeout:30000});await page.evaluate(()=>document.fonts.ready);if(selector)await page.locator(selector).first().screenshot({path:`site-screenshots/${name}-${width}-${theme}.png`,animations:'disabled',timeout:10000});else await page.screenshot({path:`site-screenshots/${name}-${width}-${theme}.png`,animations:'disabled'})}
   catch(error){console.log(`The live ${route||'landing'} could not be captured at ${width} ${theme}: ${error.message}`)}
  }
 }
 // The live site's first screen at the same widths, so a change's pictures show before and after. The live site is
 // not this build: a failure to reach it is logged and never fails the check.
 if(width===390||width===1280){
  try {await page.goto('https://openquarry.dev/',{timeout:30000});await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:`site-screenshots/live-hero-${width}-${theme}.png`,animations:'disabled'})}
  catch(error){console.log(`The live site could not be captured at ${width} ${theme}: ${error.message}`)}
 }
 await page.close()
}
} finally {await browser.close();server.close()}
