(() => {
  'use strict';
  const chapters = window.HMI_HELP;
  const $ = id => document.getElementById(id);
  const metadata = window.HMI_HELP_META;
  $('stat-topics').textContent = metadata.topics;
  $('stat-graphics').textContent = metadata.screenshots + metadata.diagrams;
  $('stat-examples').textContent = metadata.examples;
  const normalize = window.HmiHelpSearch.normalize;
  const escapeHtml = s => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const index = new Map(chapters.map(c => [c.id,c]));
  const searchable = window.HmiHelpSearch.build(chapters);
  let current = 'start', bookmarks = new Set(), bookmarkMode = false, toastTimer, searchTimer;
  try { const saved = JSON.parse(localStorage.getItem('hmi-help-bookmarks') || '[]'); if(Array.isArray(saved)) bookmarks = new Set(saved.filter(x => index.has(x))); } catch {}
  function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'),3200); }
  function nav() {
    const groups = [...new Set(chapters.map(c=>c.group))];
    $('navigation').innerHTML = groups.map(group => {
      const visible = chapters.filter(c=>c.group===group && (!bookmarkMode || bookmarks.has(c.id)));
      if (!visible.length) return '';
      return '<section class="nav-group"><h2>'+escapeHtml(group)+'</h2>'+visible.map(c=>'<a href="#'+c.id+'"'+(c.id===current?' aria-current="page"':'')+'>'+escapeHtml(c.title)+'</a>').join('')+'</section>';
    }).join('') || '<p class="empty">Zapisz rozdział przyciskiem ☆ nad jego treścią. Pojawi się tutaj.</p>';
    $('bookmark-count').textContent = bookmarks.size;
    $('all-topics').classList.toggle('active',!bookmarkMode); $('bookmarks').classList.toggle('active',bookmarkMode);
    $('save-topic').setAttribute('aria-pressed', String(bookmarks.has(current)));
    $('save-topic').textContent = bookmarks.has(current) ? '★ Zapisany rozdział' : '☆ Zapisz rozdział';
  }
  function closeMenu(){ document.body.classList.remove('menu-open'); $('menu-toggle').setAttribute('aria-expanded','false'); }
  function route() {
    clearTimeout(searchTimer); $('search').value=''; $('results').hidden=true; $('reading').hidden=false; $('on-page').hidden=false;
    let route; try { route=decodeURIComponent(location.hash.slice(1)); } catch { route='start'; }
    if (route==='main') { window.scrollTo({top:0,behavior:'smooth'}); return; }
    const [id, section] = route.split('/');
    const chapter=index.get(id)||index.get('start'); current=chapter.id;
    document.title=chapter.title+' — HMI Studio • Pomoc';
    $('breadcrumb').textContent=chapter.group; $('read-time').textContent=chapter.minutes+' min czytania';
    $('article-title').textContent=chapter.title; $('article-summary').textContent=chapter.summary;
    $('home-intro').hidden=current!=='start'; $('article').innerHTML=chapter.html;
    $('toc').innerHTML=chapter.toc.map(h=>'<a class="level-'+h.level+'" href="#'+chapter.id+'/'+h.id+'">'+escapeHtml(h.title)+'</a>').join('');
    const position=chapters.indexOf(chapter);
    for(const [el,offset,label] of [['previous',-1,'← Poprzedni'],['next',1,'Następny →']]) {
      const destination=chapters[position+offset]; $(el).hidden=!destination;
      if(destination){$(el).href='#'+destination.id;$(el).innerHTML='<small>'+label+'</small>'+escapeHtml(destination.title);}
    }
    nav(); closeMenu();
    requestAnimationFrame(()=>{const target=section ? document.getElementById(chapter.id+'-'+section):null; if(target) target.scrollIntoView(); else window.scrollTo(0,0);});
  }
  function highlight(text, words) {
    // Matching keeps the original Polish text. NFD normalization is one-to-one
    // for the supported alphabet after removing accents.
    const folded=normalize(text); const spans=[];
    for(const word of words){ let offset=0, at; while((at=folded.indexOf(word,offset))>=0){spans.push([at,at+word.length]); offset=at+word.length;} }
    spans.sort((a,b)=>a[0]-b[0]); let result='',cursor=0;
    for(const [start,end] of spans){if(start<cursor)continue;result+=escapeHtml(text.slice(cursor,start))+'<mark>'+escapeHtml(text.slice(start,end))+'</mark>';cursor=end;}
    return result+escapeHtml(text.slice(cursor));
  }
  function search(){
    const query=$('search').value.trim(); if(!query){route();return;}
    const words=normalize(query).split(/\s+/).filter(Boolean);
    const ranked=window.HmiHelpSearch.find(searchable,query);
    $('reading').hidden=true; $('on-page').hidden=true; $('results').hidden=false;
    $('results-title').textContent='Wyniki dla „'+query+'”'; $('result-count').textContent=ranked.length+' rozdziałów. Wyszukiwanie obejmuje opisy, instrukcje, tabele i kod.';
    $('result-list').innerHTML=ranked.map(({c})=>{
      const at=normalize(c.text).indexOf(words[0]),start=Math.max(0,at-85);let snippet=(start?'… ':'')+c.text.slice(start,start+260)+(start+260<c.text.length?'…':'');
      return '<a class="search-result" href="#'+c.id+'"><small>'+escapeHtml(c.group)+'</small><strong>'+highlight(c.title,words)+'</strong><p>'+highlight(c.summary,words)+'</p><p>'+highlight(snippet,words)+'</p></a>';
    }).join('') || '<div class="empty">Nie znaleziono rozdziału. Spróbuj krótszego hasła, np. „tag”, „zapis”, „historia” lub „popup”. <a href="#troubleshooting">Otwórz rozwiązywanie problemów</a>.</div>';
    window.scrollTo(0,0);
  }
  async function copy(text){
    try { if(navigator.clipboard && window.isSecureContext){await navigator.clipboard.writeText(text);return true;} } catch {}
    const active=document.activeElement, area=document.createElement('textarea'); area.value=text;area.setAttribute('readonly','');area.style.position='fixed';area.style.left='-10000px';document.body.append(area);area.select();let copied=false;
    try{copied=document.execCommand('copy');}catch{}finally{area.remove();active?.focus();}return copied;
  }
  function openImage(button){const img=button.querySelector('img');$('large-image').src=img.src;$('large-image').alt=img.alt;$('image-caption').textContent=img.alt;$('image-dialog').querySelector('.image-stage').classList.remove('original');$('image-size').textContent='Rozmiar oryginalny';$('image-dialog').showModal();$('image-close').focus();}
  document.addEventListener('click',async e=>{
    const zoom=e.target.closest('.zoom-image'); if(zoom){openImage(zoom);return;}
    const code=e.target.closest('.copy-code'); if(code){toast(await copy(code.closest('.code-block').querySelector('code').textContent)?'Kod skopiowany.':'Nie udało się skopiować. Zaznacz kod i użyj Ctrl+C.');return;}
    const anchor=e.target.closest('a[href^="#"]');
    if(anchor && anchor.hash===location.hash){e.preventDefault();route();}
  });
  $('search').addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(search,130);});
  $('search').addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();route();$('main').focus();} if(e.key==='Enter'){clearTimeout(searchTimer);search();$('result-list').querySelector('a')?.focus();}});
  $('menu-toggle').onclick=()=>{const visible=document.body.classList.toggle('menu-open');$('menu-toggle').setAttribute('aria-expanded',String(visible));};
  $('all-topics').onclick=()=>{bookmarkMode=false;nav();};$('bookmarks').onclick=()=>{bookmarkMode=true;nav();};
  $('save-topic').onclick=()=>{if(bookmarks.has(current))bookmarks.delete(current);else bookmarks.add(current);let stored=true;try{localStorage.setItem('hmi-help-bookmarks',JSON.stringify([...bookmarks]));}catch{stored=false;}nav();toast(stored?'Zaktualizowano zakładki.':'Zakładka działa do zamknięcia strony; przeglądarka blokuje trwały zapis.');};
  $('copy-link').onclick=async()=>toast(await copy(location.href)?'Odnośnik skopiowany. Plik pomocy musi być dostępny na komputerze odbiorcy.':'Nie udało się skopiować; skopiuj adres z paska przeglądarki.');
  $('print-topic').onclick=()=>window.print();
  $('print-all').onclick=()=>{
    $('print-content').innerHTML='<header><p>HMI STUDIO · 0.34.1</p><h1>Podręcznik użytkownika</h1><p>Developer · Runtime · Client</p><p>44 rozdziały z instrukcjami, grafikami i przykładami.</p></header>'+chapters.map((c,i)=>'<section class="print-chapter"><p class="eyebrow">'+(i+1)+'. '+escapeHtml(c.group)+'</p><h1>'+escapeHtml(c.title)+'</h1><p>'+escapeHtml(c.summary)+'</p><article>'+c.html+'</article></section>').join('');
    const images=[...$('print-content').querySelectorAll('img')];images.forEach(img=>img.loading='eager');
    document.body.classList.add('print-all');
    Promise.all(images.map(img=>img.decode().catch(()=>{}))).then(()=>window.print());
  };
  window.addEventListener('afterprint',()=>{document.body.classList.remove('print-all');$('print-content').replaceChildren();});
  $('image-close').onclick=()=>$('image-dialog').close();
  $('image-size').onclick=()=>{const original=$('image-dialog').querySelector('.image-stage').classList.toggle('original');$('image-size').textContent=original?'Dopasuj do okna':'Rozmiar oryginalny';};
  $('image-dialog').addEventListener('click',e=>{if(e.target===$('image-dialog'))$('image-dialog').close();});
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)&&!$('image-dialog').open){e.preventDefault();$('search').focus();}if(e.key==='Escape')closeMenu();});
  window.addEventListener('hashchange',route);route();
})();
