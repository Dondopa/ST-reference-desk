const MODULE = 'st-reference-desk';
const DB_KEY = `${MODULE}:documents`;
let initialized = false;
let docs = [];
let activeId = null;
let searchTerm = '';

function esc(s='') { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function idFor(s='') { return 'rd-' + s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70); }
function toast(msg, type='info') { window.toastr?.[type]?.(msg) ?? console.log(`[Reference Desk] ${msg}`); }

async function storage() {
  const lf = window.SillyTavern?.libs?.localforage;
  if (!lf) throw new Error('localforage is unavailable');
  return lf;
}
async function loadDocs(){ try { docs = (await (await storage()).getItem(DB_KEY)) || []; } catch(e){ console.error(e); docs=[]; } activeId ||= docs[0]?.id || null; }
async function saveDocs(){ await (await storage()).setItem(DB_KEY, docs); }

function inline(md) {
  let x = esc(md);
  x = x.replace(/`([^`]+)`/g, '<code class="rd-code">$1</code>');
  x = x.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  x = x.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  x = x.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
  x = x.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  x = x.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return x;
}
function table(lines, start){
  const rows=[]; let i=start;
  while(i<lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(lines[i].trim().slice(1,-1).split('|').map(x=>x.trim())); i++; }
  if(rows.length<2 || !rows[1].every(c=>/^:?-{3,}:?$/.test(c))) return null;
  const head=rows[0], body=rows.slice(2);
  return { next:i, html:`<div class="rd-table-wrap"><table><thead><tr>${head.map(c=>`<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body.map(r=>`<tr>${head.map((_,j)=>`<td>${inline(r[j]||'')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` };
}
function markdown(md){
  const lines=String(md).replace(/\r/g,'').split('\n'); let out='', para=[], list=null, fence=false, code=[];
  const flush=()=>{ if(para.length){ out+=`<p>${inline(para.join(' '))}</p>`; para=[]; } if(list){ out+=`</${list}>`; list=null; } };
  for(let i=0;i<lines.length;i++){
    const l=lines[i];
    if(/^```/.test(l)){ flush(); if(!fence){fence=true;code=[];} else {out+=`<pre><code>${esc(code.join('\n'))}</code></pre>`;fence=false;} continue; }
    if(fence){code.push(l);continue;}
    const t=table(lines,i); if(t){flush();out+=t.html;i=t.next-1;continue;}
    const h=l.match(/^(#{1,6})\s+(.+)$/); if(h){flush(); const n=h[1].length, text=h[2]; out+=`<h${n} id="${idFor(text)}">${inline(text)}</h${n}>`;continue;}
    if(/^\s*---+\s*$/.test(l)){flush();out+='<hr>';continue;}
    const ul=l.match(/^\s*[-*+]\s+(.+)$/), ol=l.match(/^\s*\d+[.)]\s+(.+)$/);
    if(ul||ol){ const want=ul?'ul':'ol'; if(list!==want){flush();list=want;out+=`<${want}>`;} out+=`<li>${inline((ul||ol)[1])}</li>`;continue; }
    if(/^>\s?/.test(l)){flush();out+=`<blockquote>${inline(l.replace(/^>\s?/,''))}</blockquote>`;continue;}
    if(!l.trim()){flush();continue;} para.push(l.trim());
  }
  flush(); if(fence) out+=`<pre><code>${esc(code.join('\n'))}</code></pre>`;
  return out;
}
function plainToHtml(text){ return `<pre class="rd-plain">${esc(text)}</pre>`; }
function csvToHtml(text){
  const rows=text.replace(/\r/g,'').split('\n').filter(Boolean).map(r=>{const a=[];let s='',q=false;for(let i=0;i<r.length;i++){const c=r[i];if(c==='"'&&r[i+1]==='"'){s+='"';i++;}else if(c==='"')q=!q;else if(c===','&&!q){a.push(s);s='';}else s+=c;}a.push(s);return a;});
  if(!rows.length)return '';
  return `<div class="rd-table-wrap"><table><thead><tr>${rows[0].map(c=>`<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.slice(1).map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function renderDoc(doc){
  const ext=doc.name.split('.').pop().toLowerCase();
  if(['md','markdown'].includes(ext)) return markdown(doc.content);
  if(ext==='json'){ try{return `<pre><code>${esc(JSON.stringify(JSON.parse(doc.content),null,2))}</code></pre>`;}catch{return plainToHtml(doc.content);} }
  if(ext==='csv') return csvToHtml(doc.content);
  if(['html','htm'].includes(ext)){ const p=new DOMParser().parseFromString(doc.content,'text/html'); p.querySelectorAll('script,iframe,object,embed,form').forEach(x=>x.remove()); p.querySelectorAll('*').forEach(el=>[...el.attributes].forEach(a=>{if(/^on/i.test(a.name)||/javascript:/i.test(a.value))el.removeAttribute(a.name);})); return p.body.innerHTML; }
  return plainToHtml(doc.content);
}
function extractKeywords(content){
  const found=[]; const re=/\*\*(?:Trigger keywords?|Keywords?)\s*:\*\*\s*([^\n]+)/gi; let m;
  while((m=re.exec(content))){ const ticks=[...m[1].matchAll(/`([^`]+)`/g)].map(x=>x[1]); const vals=ticks.length?ticks:m[1].split(/[,;]/).map(x=>x.replace(/[*_`]/g,'').trim()).filter(Boolean); found.push(...vals); }
  return [...new Set(found)];
}
function headings(content){ return content.split(/\r?\n/).map(l=>l.match(/^(#{1,4})\s+(.+)$/)).filter(Boolean).map(m=>({level:m[1].length,text:m[2].replace(/[*_`]/g,''),id:idFor(m[2])})); }
function highlight(root, term){ if(!term)return; const walk=document.createTreeWalker(root,NodeFilter.SHOW_TEXT); const nodes=[]; while(walk.nextNode())nodes.push(walk.currentNode); const re=new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'); nodes.forEach(n=>{if(!re.test(n.nodeValue))return;re.lastIndex=0;const span=document.createElement('span');span.innerHTML=esc(n.nodeValue).replace(re,m=>`<mark class="rd-hit">${m}</mark>`);n.parentNode.replaceChild(span,n);}); }
function active(){return docs.find(d=>d.id===activeId);}

function render(){
  updateSettingsStatus();
  const d=active();
  $('#rd-tabs').html(docs.map(x=>`<button class="rd-tab ${x.id===activeId?'active':''}" data-id="${x.id}">${esc(x.name.replace(/\.[^.]+$/,''))}<span data-remove="${x.id}">×</span></button>`).join(''));
  $('#rd-empty').toggle(!d); $('#rd-workspace').toggle(!!d); if(!d)return;
  $('#rd-toc').html(headings(d.content).map(h=>`<button style="--depth:${h.level}" data-jump="${h.id}">${esc(h.text)}</button>`).join('') || '<small>No Markdown headings detected.</small>');
  $('#rd-keywords').html(extractKeywords(d.content).map(k=>`<button class="rd-key" data-key="${esc(k)}" title="Tap to copy; use + to insert">${esc(k)} <span data-insert="${esc(k)}">＋</span></button>`).join(''));
  const viewer=document.querySelector('#rd-viewer'); viewer.innerHTML=renderDoc(d); highlight(viewer,searchTerm);
  if(searchTerm){ const first=viewer.querySelector('.rd-hit'); first?.scrollIntoView({block:'center'}); }
}
function insertIntoChat(text){
  const ta=document.querySelector('#send_textarea'); if(!ta){toast('Could not find SillyTavern message box.','warning');return;}
  const a=ta.selectionStart??ta.value.length,b=ta.selectionEnd??a; ta.value=ta.value.slice(0,a)+text+ta.value.slice(b); ta.selectionStart=ta.selectionEnd=a+text.length; ta.dispatchEvent(new Event('input',{bubbles:true})); ta.focus(); toast(`Inserted: ${text}`,'success');
}
async function importFiles(files){
  for(const f of files){ const ext=f.name.split('.').pop().toLowerCase(); if(!['md','markdown','txt','html','htm','json','yaml','yml','csv'].includes(ext)){toast(`Skipped unsupported file: ${f.name}`,'warning');continue;} const content=await f.text(); const old=docs.find(x=>x.name===f.name); if(old){old.content=content;old.updated=Date.now();activeId=old.id;}else{const d={id:crypto.randomUUID(),name:f.name,content,updated:Date.now()};docs.push(d);activeId=d.id;} }
  await saveDocs(); render();
}
function settingsPanel(){
  if (document.getElementById('rd-settings')) return;
  const target = document.querySelector('#extensions_settings2') || document.querySelector('#extensions_settings');
  if (!target) {
    console.warn('[ST Reference Desk] Extensions settings container not found yet.');
    return;
  }
  target.insertAdjacentHTML('beforeend', `
    <div id="rd-settings" class="rd-settings-block">
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>📖 Reference Desk</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
          <p>Rendered manuals and lore references for SillyTavern.</p>
          <div class="rd-settings-actions">
            <button id="rd-settings-open" class="menu_button">📖 Open Reference Desk</button>
            <button id="rd-settings-import" class="menu_button">＋ Import Manual</button>
          </div>
          <small id="rd-settings-status">Ready</small>
        </div>
      </div>
    </div>`);
  $('#rd-settings-open').off('click.rd').on('click.rd',()=>$('#rd-overlay').addClass('open'));
  $('#rd-settings-import').off('click.rd').on('click.rd',()=>$('#rd-file').trigger('click'));
}

function updateSettingsStatus(){
  const el=document.getElementById('rd-settings-status');
  if(el) el.textContent=`${docs.length} manual${docs.length===1?'':'s'} loaded · v0.2.0`;
}

function shell(){
  $('body').append(`<div id="rd-overlay"><section id="rd-panel"><header><strong>📖 Reference Desk <small>v0.2.0</small></strong><div><button id="rd-add">＋ Open</button><button id="rd-close">×</button></div></header><div id="rd-tabs"></div><div class="rd-tools"><input id="rd-search" placeholder="Search this manual…"><button id="rd-clear">Clear</button></div><div id="rd-empty"><h3>Reference Desk</h3><p>Open Markdown or another supported reference file. Your manuals are stored locally and restored next session.</p><button id="rd-empty-open">Open a manual</button></div><div id="rd-workspace"><aside><h4>Contents</h4><div id="rd-toc"></div><h4>Trigger Keywords</h4><div id="rd-keywords"></div></aside><main id="rd-viewer"></main></div><input id="rd-file" type="file" multiple accept=".md,.markdown,.txt,.html,.htm,.json,.yaml,.yml,.csv" hidden></section></div>`);
  $('#rd-close').on('click',()=>$('#rd-overlay').removeClass('open'));
  $('#rd-overlay').on('click',e=>{if(e.target.id==='rd-overlay')$('#rd-overlay').removeClass('open');});
  $('#rd-add,#rd-empty-open').on('click',()=>$('#rd-file').trigger('click'));
  $('#rd-file').on('change',async e=>{await importFiles([...e.target.files]);e.target.value='';});
  $('#rd-tabs').on('click',async e=>{const rem=e.target.dataset.remove;if(rem){e.stopPropagation();docs=docs.filter(d=>d.id!==rem);if(activeId===rem)activeId=docs[0]?.id||null;await saveDocs();render();return;}const b=e.target.closest('[data-id]');if(b){activeId=b.dataset.id;searchTerm='';$('#rd-search').val('');render();}});
  $('#rd-toc').on('click',e=>{const b=e.target.closest('[data-jump]');document.getElementById(b?.dataset.jump)?.scrollIntoView({behavior:'smooth',block:'start'});});
  $('#rd-keywords').on('click',async e=>{const ins=e.target.dataset.insert;if(ins){e.stopPropagation();insertIntoChat(ins);return;}const b=e.target.closest('[data-key]');if(b){await navigator.clipboard.writeText(b.dataset.key);toast(`Copied: ${b.dataset.key}`,'success');}});
  let timer; $('#rd-search').on('input',e=>{clearTimeout(timer);timer=setTimeout(()=>{searchTerm=e.target.value.trim();render();},120);});
  $('#rd-clear').on('click',()=>{searchTerm='';$('#rd-search').val('');render();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')$('#rd-overlay').removeClass('open');});
}

export async function init(){
  if(initialized) return;
  initialized=true;
  console.log('[ST Reference Desk] init v0.2.0');

  try {
    if (!document.getElementById('rd-overlay')) shell();
    settingsPanel();
  } catch (error) {
    initialized=false;
    console.error('[ST Reference Desk] could not create UI', error);
    window.toastr?.error?.('Reference Desk could not create its UI. Check browser console.');
    return;
  }

  try {
    await loadDocs();
    render();
    console.log('[ST Reference Desk] ready v0.2.0');
  } catch (error) {
    console.error('[ST Reference Desk] storage failed; continuing without restored manuals', error);
    docs=[];
    activeId=null;
    render();
    window.toastr?.warning?.('Reference Desk loaded, but saved manuals could not be restored.');
  }
}

export async function onActivate(){
  await init();
}

// Fallback for clients that load the module without invoking the manifest hook.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => init(), { once: true });
} else {
  queueMicrotask(() => init());
}
