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
 if(shows('.menu-key')!==(innerWidth<1000))errors.push('the menu key shows at the wrong width')
 if(shows('.menu-key')&&shows('.top .main-nav'))errors.push('the menu key and the header links show together')
 if(shows('.top .main-nav')!==(innerWidth>=1000))errors.push('the header links show at the wrong width')
 if(document.querySelector('.top .used-by'))errors.push('the header holds Used by, which belongs in the footer')
 // The row's links are all in view: none is cut off at the row's edge or scrolled out of it.
 const nav=document.querySelector('.top .main-nav')
 if(nav&&nav.getClientRects().length&&nav.scrollWidth>nav.clientWidth+1)errors.push('the header links are cut off')
 if(!shows('.top>[data-theme-toggle]')&&!document.querySelector('.menu-panel [data-theme-toggle]'))errors.push('no look switch')
 // The keys under a heading never wrap: the outlined keys share one row and no key breaks or clips its label. The
 // hero's four keys are one row from 1280 px and two rows of two below it, all of one width. The badges are one row
 // too, and it fits the page at every width (checked below).
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
 // The facts row fits the page at every width: one row, nothing scrolled, faded or cut at its edge, each fact whole.
 for(const facts of document.querySelectorAll('.badges')){
  const box=facts.getBoundingClientRect(),style=getComputedStyle(facts),mask=style.maskImage||style.webkitMaskImage
  if(facts.scrollWidth>facts.clientWidth+1)errors.push('the facts row scrolls sideways')
  if(mask&&mask!=='none')errors.push('the facts row is faded at an edge')
  for(const fact of facts.querySelectorAll('li')){const r=fact.getBoundingClientRect();if(r.left<box.left-1||r.right>box.right+1||r.right>innerWidth)errors.push('a fact is cut off: '+fact.textContent)}
  for(const part of facts.querySelectorAll('span,strong'))if(part.scrollWidth>part.clientWidth+1)errors.push('a fact does not fit its chip: '+part.textContent)
  // A box measured while the hero's arrival animation moves it can read a hair under its height, so the sizes round.
  if(innerWidth<=900)for(const a of facts.querySelectorAll('a'))if(Math.round(a.getBoundingClientRect().height)<44)errors.push('a fact is under 44 px tall')
 }
 // The guides' row: its tabs sit in a strip between a previous and a next key. The keys show only when the tabs do
 // not fit; then each is a named button of 44 px or more inside the page, beside the strip and on its line.
 const guides=document.querySelector('.docs-nav')
 if(guides){
  const strip=guides.querySelector('.docs-tabs'),arrows=[guides.querySelector('button[data-tabs-prev]'),guides.querySelector('button[data-tabs-next]')]
  if(!strip||arrows.some(k=>!k))errors.push('the guides row lacks its strip or its two arrow keys')
  else{
   const over=strip.scrollWidth>strip.clientWidth+1,shown=arrows.filter(k=>k.getClientRects().length)
   if(over&&shown.length!==2)errors.push('the guides scroll sideways with no arrow keys')
   if(!over&&shown.length)errors.push('arrow keys show on a guides row that fits')
   if(innerWidth<=480&&!over)errors.push('the guides fit a phone: the arrow keys are not exercised')
   if(arrows[0].getAttribute('aria-label')!=='Previous guides'||arrows[1].getAttribute('aria-label')!=='Next guides')errors.push('an arrow key lacks its name')
   if(arrows.some(k=>k.getAttribute('aria-controls')!==strip.id||!strip.id))errors.push('an arrow key does not name the strip it moves')
   for(const k of shown){const r=k.getBoundingClientRect();if(Math.round(r.width)<44||Math.round(r.height)<44)errors.push('an arrow key is under 44 px');if(r.left<0||r.right>innerWidth)errors.push('an arrow key leaves the page')}
   if(shown.length===2){
    const s=strip.getBoundingClientRect(),[p,n]=shown.map(k=>k.getBoundingClientRect()),mid=r=>r.top+r.height/2
    if(p.right>s.left+1||n.left<s.right-1)errors.push('an arrow key overlaps the tabs')
    if(Math.abs(mid(p)-mid(s))>3||Math.abs(mid(n)-mid(s))>3)errors.push('the arrow keys are not on the line of the tabs')
    if(s.width<150)errors.push('the arrow keys leave under 150 px for the tabs')
   }
   if(guides.getBoundingClientRect().height>64)errors.push('the guides row is taller than one line')
  }
 }
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
 if(startCopied!==await page.locator('.start pre code').first().textContent()||!startCopied.startsWith('npx openquarry init my-notes\n'))throw Error('The clipboard does not hold the Start a project commands: '+startCopied)
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
} catch(error){await browser.close();server.close();throw error}
// The facts row and the guides' arrow keys on the real pages, at each phone width and one tablet width, in both
// looks. The pictures are taken at 2x.
const base='http://127.0.0.1:4173/'
// Every scroll the page asks of the strip is recorded with the behaviour it asked for, then carried out.
const record=()=>{window.__scrolls=[];const real=Element.prototype.scrollTo;Element.prototype.scrollTo=function(...args){if(this.classList&&this.classList.contains('docs-tabs'))window.__scrolls.push(String(args[0]&&args[0].behavior));return real.apply(this,args)}}
const open=async(page,route)=>{const response=await page.goto(base+route);if(response.status()!==200)throw Error('Missing '+route);await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))}
const row=page=>page.evaluate(()=>{
 const g=document.querySelector('.docs-nav'),s=g.querySelector('.docs-tabs'),b=s.getBoundingClientRect(),style=getComputedStyle(s)
 const key=q=>{const e=g.querySelector(q);return {shown:e.getClientRects().length>0,off:e.getAttribute('aria-disabled')==='true',focused:document.activeElement===e}}
 return {left:s.scrollLeft,end:s.scrollWidth-s.clientWidth,view:s.clientWidth,over:s.scrollWidth>s.clientWidth+1,scroll:g.dataset.scroll,mask:style.maskImage||style.webkitMaskImage||'none',fades:[style.getPropertyValue('--fade-l').trim(),style.getPropertyValue('--fade-r').trim()],prev:key('[data-tabs-prev]'),next:key('[data-tabs-next]'),tabs:[...s.querySelectorAll('a')].map(a=>{const r=a.getBoundingClientRect();return {name:a.textContent,width:r.width,left:r.left-b.left,right:r.right-b.left,whole:r.left>=b.left-1&&r.right<=b.right+1}})}
})
// The strip has come to rest when its position has not changed for 200 ms.
const rest=async page=>{let last=-1,same=0;for(let i=0;i<100&&same<4;i++){await page.waitForTimeout(50);const now=await page.evaluate(()=>document.querySelector('.docs-tabs').scrollLeft);same=now===last?same+1:0;last=now}if(same<4)throw Error('the strip never came to rest')}
const press=async(page,which,how='click')=>{
 const before=await row(page)
 if(how==='keyboard'){await page.locator(`[data-tabs-${which}]`).focus();await page.keyboard.press('Enter')}else await page.locator(`[data-tabs-${which}]`).click()
 await page.waitForFunction(left=>document.querySelector('.docs-tabs').scrollLeft!==left,before.left,{timeout:5000})
 await rest(page)
 return [before,await row(page)]
}
const fadeOf=s=>s.fades.map(f=>parseFloat(f)>0)
// A pointer press in the middle of an inactive key (Playwright's own click waits for a key that is not aria-disabled).
const poke=async(page,which)=>{const box=await page.locator(`[data-tabs-${which}]`).boundingBox();await page.mouse.click(box.x+box.width/2,box.y+box.height/2);await page.waitForTimeout(250)}
// A picture is taken with the pointer off the keys, so none is drawn in its hover look.
const picture=async(page,name,height)=>{await page.mouse.move(1,1);return page.screenshot({path:`site-screenshots/${name}.png`,clip:{x:0,y:0,width:page.viewportSize().width,height},animations:'disabled'})}
try {
for(const width of [320,360,390,430,480,768]) for(const theme of ['light','dark']) {
 const at=`${width} ${theme}`
 const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:'no-preference',deviceScaleFactor:2})
 const page=await context.newPage()
 await page.addInitScript(record)
 // The facts row on the landing and on the package page, and every other rule of a page at this width.
 for(const route of ['','package/','format/','spiral/','schema/']){
  await open(page,route)
  const issues=await page.evaluate(inspect)
  if(issues.length){await page.screenshot({path:`site-screenshots/failed-${width}-${theme}-${route.replace('/','')||'home'}.png`,fullPage:true,animations:'disabled'});throw Error(`${at} ${route}: ${issues.join(', ')}`)}
  if(route==='package/'){
   const facts=await page.locator('.badges li').allTextContents()
   if(facts.length!==3||!/^npm/.test(facts[0])||!/^licence/.test(facts[1])||!/^node\d+ or later$/.test(facts[2]))throw Error(`${at}: the package facts are not npm, licence and node: ${facts.join(' | ')}`)
   // The picture runs from the top of the page to just under the keys below the facts.
   if(width<=390||width===768)await picture(page,`facts-package-${width}-${theme}`,Math.min(900,Math.ceil(await page.locator('.reading .actions').first().evaluate(e=>e.getBoundingClientRect().bottom))+24))
  }
  if(!route&&width<=390)await page.locator('.hero').screenshot({path:`site-screenshots/facts-landing-${width}-${theme}.png`,animations:'disabled'})
  // A reader's text at 200 per cent (a browser's text-only zoom, set here on the facts themselves): the facts may
  // take a second row, and the page keeps to its width with every fact inside it.
  if(width===320&&(route===''||route==='package/')){
   await page.addStyleTag({content:'.badges a{font-size:30px!important}'})
   const big=await page.evaluate(()=>({page:document.documentElement.scrollWidth>innerWidth,cut:[...document.querySelectorAll('.badges li')].filter(li=>li.getBoundingClientRect().right>innerWidth+1||li.getBoundingClientRect().left<0).map(li=>li.textContent)}))
   if(big.page||big.cut.length)throw Error(`${at} ${route}: with text at 200 per cent the facts leave the page: ${big.cut.join(' | ')}`)
  }
 }
 // The first guide: the strip opens at its start, Previous is inactive, and only the right edge fades.
 await open(page,'format/')
 let s=await row(page)
 if(s.over){
  if(!s.prev.shown||!s.next.shown)throw Error(`${at}: the guides overflow with no arrow keys`)
  if(s.left!==0||!s.prev.off||s.next.off||s.scroll!=='start')throw Error(`${at}: the first guide should open at the start with Previous inactive: ${JSON.stringify(s)}`)
  if(!/gradient/.test(s.mask)||fadeOf(s).join()!=='false,true')throw Error(`${at}: at the start only the right edge fades: ${s.mask} ${s.fades}`)
  if(width===390)await picture(page,`guides-start-${width}-${theme}`,300)
  // A press on the inactive key moves nothing.
  await poke(page,'prev')
  if((await row(page)).left!==0)throw Error(`${at}: the inactive Previous key moved the strip`)
  // Next, press after press, to the end: each press moves the strip by no more than one view, and the tab the right
  // edge cut is then whole in view. The whole row takes no more presses than it has tabs.
  let presses=0
  while(!s.next.off){
   if(++presses>s.tabs.length)throw Error(`${at}: Next takes more presses than the row has tabs`)
   const [before,after]=await press(page,'next',presses===1&&width===390?'keyboard':'click')
   const moved=after.left-before.left,cut=before.tabs.find(t=>t.right>before.view+.5)
   if(moved<=0||moved>before.view+1)throw Error(`${at}: Next moved the strip ${moved} px of a ${before.view} px view`)
   if(cut&&cut.width<=after.view-60&&!after.tabs.find(t=>t.name===cut.name).whole)throw Error(`${at}: after Next the tab ${cut.name} is not whole in view`)
   if(after.prev.off||!after.prev.shown)throw Error(`${at}: Previous is inactive away from the start`)
   if(presses===1&&width===390&&!after.next.focused)throw Error(`${at}: the keyboard press took focus off Next`)
   if(after.scroll!==(after.next.off?'end':'middle')||fadeOf(after).join()!==(after.next.off?'true,false':'true,true'))throw Error(`${at}: the fade does not follow the strip: ${after.scroll} ${after.fades}`)
   if(presses===1&&!after.next.off&&(width===390||width===320))await picture(page,`guides-middle-${width}-${theme}`,300)
   s=after
  }
  if(presses<1)throw Error(`${at}: Next was inactive at the start`)
  if(Math.abs(s.left-s.end)>1||!s.tabs[s.tabs.length-1].whole)throw Error(`${at}: at the end the last guide is not whole in view`)
  await poke(page,'next')
  if(Math.abs((await row(page)).left-s.left)>1)throw Error(`${at}: the inactive Next key moved the strip`)
  // And back with Previous to the start.
  presses=0
  while(!s.prev.off){
   if(++presses>s.tabs.length)throw Error(`${at}: Previous takes more presses than the row has tabs`)
   const [before,after]=await press(page,'prev')
   const moved=before.left-after.left,cut=[...before.tabs].reverse().find(t=>t.left<-.5)
   if(moved<=0||moved>before.view+1)throw Error(`${at}: Previous moved the strip ${moved} px of a ${before.view} px view`)
   if(cut&&cut.width<=after.view-60&&!after.tabs.find(t=>t.name===cut.name).whole)throw Error(`${at}: after Previous the tab ${cut.name} is not whole in view`)
   if(after.next.off)throw Error(`${at}: Next is inactive away from the end`)
   s=after
  }
  if(s.left!==0||!s.tabs[0].whole||s.scroll!=='start')throw Error(`${at}: Previous did not bring the strip back to its start`)
  // Every move was asked of the browser as a smooth scroll.
  const asked=await page.evaluate(()=>window.__scrolls)
  if(!asked.length||asked.some(b=>b!=='smooth'))throw Error(`${at}: the keys did not ask for a smooth scroll: ${asked}`)
  if(await page.locator('[data-tabs-next]').evaluate(k=>getComputedStyle(k).transitionDuration.split(',').every(d=>parseFloat(d)===0)))throw Error(`${at}: the arrow keys have no hover or press transition`)
  // A guide in the middle opens with its tab whole in view; the last guide opens at the end with Next inactive.
  await open(page,'spiral/')
  s=await row(page)
  if(!s.tabs.find(t=>t.name==='Spiral learning').whole)throw Error(`${at}: the current guide's tab is not in view`)
  await open(page,'schema/')
  s=await row(page)
  if(!s.tabs.find(t=>t.name==='Schemas').whole||!s.next.off||s.prev.off||s.scroll!=='end'||fadeOf(s).join()!=='true,false')throw Error(`${at}: the last guide should open at the end with Next inactive: ${JSON.stringify(s)}`)
  if(width===390)await picture(page,`guides-end-${width}-${theme}`,300)
  if(width===768&&theme==='light'){await open(page,'courses/');await picture(page,`guides-${width}-${theme}`,300)}
 } else if(width<=480)throw Error(`${at}: the guides fit a phone, so the arrow keys were not exercised`)
 // The live site at the same width, for the pictures of a change: never part of the check.
 if(width===390){
  for(const [route,name,height] of [['spiral/','live-guides',300],['package/','live-facts-package',700]]){
   try {await page.goto('https://openquarry.dev/'+route,{timeout:30000});await page.evaluate(()=>document.fonts.ready);await picture(page,`${name}-${width}-${theme}`,height)}
   catch(error){console.log(`The live ${route} could not be captured at ${at}: ${error.message}`)}
  }
 }
 await context.close()
}
// The reader's own moves count. A wheel or swipe during a key's move: the next press starts from where the strip is,
// not from where the key was taking it. A tab that holds the keyboard's focus is not scrolled away when the window
// changes size.
{
 const context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'no-preference'})
 const page=await context.newPage()
 await open(page,'format/')
 await press(page,'next')
 // In one turn of the page: Next is pressed, the reader's wheel takes the strip to its end, Previous is pressed.
 const swiped=await page.evaluate(()=>{const g=document.querySelector('.docs-nav'),s=g.querySelector('.docs-tabs');g.querySelector('[data-tabs-next]').click();s.dispatchEvent(new WheelEvent('wheel',{bubbles:true,deltaX:600}));s.scrollLeft=s.scrollWidth;const end=s.scrollLeft;g.querySelector('[data-tabs-prev]').click();return {end,view:s.clientWidth}})
 await rest(page)
 const after=(await row(page)).left
 if(after>=swiped.end||swiped.end-after>swiped.view+1)throw Error(`After the reader's own scroll to the end (${swiped.end}), Previous took the strip to ${after}: more than one ${swiped.view} px view, or nowhere`)
 await open(page,'schema/')
 await page.locator('.docs-tabs a').first().focus()
 await rest(page)
 await page.setViewportSize({width:400,height:900})
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
 await rest(page)
 const held=await row(page)
 if(!held.tabs[0].whole)throw Error(`The focused first guide was scrolled out of view when the window changed size: ${JSON.stringify(held.tabs[0])}`)
 await context.close()
}
// Reduced motion: a press puts the strip in its new place with no animation, and the keys have no transition.
{
 const context=await browser.newContext({viewport:{width:390,height:900},reducedMotion:'reduce'})
 const page=await context.newPage()
 await page.addInitScript(record)
 await open(page,'format/')
 await page.locator('[data-tabs-next]').click()
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))))
 const first=(await row(page)).left
 await rest(page)
 const s=await row(page),asked=await page.evaluate(()=>window.__scrolls)
 if(first<=0||s.left!==first)throw Error(`Reduced motion: the strip did not jump to its place at once (${first}, then ${s.left})`)
 if(asked.length!==1||asked[0]==='smooth')throw Error(`Reduced motion: the key asked for an animated scroll: ${asked}`)
 if(!(await page.locator('[data-tabs-next]').evaluate(k=>getComputedStyle(k).transitionDuration.split(',').every(d=>parseFloat(d)===0))))throw Error('Reduced motion: the arrow keys keep a transition')
 await context.close()
}
// The script does not run: no arrow key shows, the strip scrolls sideways with a fade, and the keyboard reaches the
// last guide.
{
 const context=await browser.newContext({viewport:{width:390,height:900}})
 const page=await context.newPage()
 await page.route('**/site.js*',route=>route.abort())
 await page.goto(base+'format/');await page.evaluate(()=>document.fonts.ready)
 const s=await row(page)
 if(s.prev.shown||s.next.shown)throw Error('Without the script an arrow key shows')
 if(!s.over||!/gradient/.test(s.mask))throw Error('Without the script the strip should scroll sideways with a faded edge')
 if(await page.locator('.docs-tabs').evaluate(e=>getComputedStyle(e).overflowX)!=='auto')throw Error('Without the script the strip cannot be scrolled')
 await page.locator('.docs-tabs a').last().focus()
 await rest(page)
 if(!(await row(page)).tabs.pop().whole)throw Error('Without the script the keyboard does not bring the last guide into view')
 await context.close()
}
// A wide screen: the tabs fit, so no arrow key shows and nothing fades.
for(const theme of ['light','dark']){
 const context=await browser.newContext({viewport:{width:1280,height:900},colorScheme:theme,deviceScaleFactor:2})
 const page=await context.newPage()
 await open(page,'format/')
 const s=await row(page)
 if(s.over||s.prev.shown||s.next.shown||s.scroll!=='none'||fadeOf(s).join()!=='false,false')throw Error(`1280 ${theme}: a guides row that fits should show no arrow key and no fade: ${JSON.stringify(s)}`)
 await picture(page,`guides-1280-${theme}`,300)
 // The window is made narrow with the strip untouched: the keys appear and the current guide's tab is whole in view.
 await open(page,'llm/')
 await page.setViewportSize({width:390,height:900})
 await page.waitForFunction(()=>document.querySelector('.docs-nav').dataset.scroll!=='none',null,{timeout:5000})
 await rest(page)
 const narrow=await row(page)
 if(!narrow.prev.shown||!narrow.next.shown||!narrow.tabs.find(t=>t.name==='Language models').whole)throw Error(`1280 to 390 ${theme}: after the window narrows the current guide's tab is not whole in view: ${JSON.stringify(narrow)}`)
 await page.setViewportSize({width:1280,height:900})
 await open(page,'package/')
 await picture(page,`facts-package-1280-${theme}`,Math.min(900,Math.ceil(await page.locator('.reading .actions').first().evaluate(e=>e.getBoundingClientRect().bottom))+24))
 await context.close()
}
} finally {await browser.close();server.close()}
