// AI Radar app (beta). Chat with sources, save to an on-device library, filter it, and ask the chat for saved items.
// Answer pipeline: (1) the user's own library when they ask for something they saved,
// (2) AI Radar resources (repos, cheatsheets, prompt packs), (3) fresh sources: GitHub for repo questions,
// otherwise Hacker News stories + Wikipedia + the Worker's news headlines, plus the Worker's short AI answer.
(function(){
  'use strict';
  var ENDPOINT='https://airadar-chat.asm-gamingyt.workers.dev';
  var ROOT=new URL('../',location.href).href;           // site root (works from /app-beta/ or /app/)
  var LIB_KEY='airadar-library-v1', CHAT_KEY='airadar-chat-v1';
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $=function(s,el){ return (el||document).querySelector(s); };
  var esc=function(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]; }); };
  var LOGO='../assets/logo.svg';

  /* ---------------- storage (on device) ---------------- */
  function load(k,d){ try{ var v=JSON.parse(localStorage.getItem(k)); return v==null?d:v; }catch(e){ return d; } }
  function store(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); return true; }catch(e){ return false; } }
  var library=load(LIB_KEY,[]);
  var chat=load(CHAT_KEY,[]);           // [{role:'user'|'bot', text, data}]
  function saveLib(){ if(!store(LIB_KEY,library)) toast("Couldn't save: storage is full or blocked"); updateBadge(); }
  function saveChat(){ store(CHAT_KEY,chat.slice(-40)); }

  /* ---------------- topics, types ---------------- */
  var TOPICS=[
    ['Agents',/\bagent|agentic|autonomous|tool use|mcp\b/i],['RAG',/\brag\b|retrieval|vector|embedding/i],
    ['Audio',/\baudio|voice|speech|tts|asr|whisper|music|sound|podcast|dubb/i],['Coding',/\bcod(e|ing)|developer|programming|ide\b|copilot|github|software/i],
    ['Images',/\bimage|vision|photo|diffusion|picture|art\b|midjourney|stable diffusion/i],['Video',/\bvideo|film|animation|sora\b/i],
    ['Prompting',/\bprompt/i],['LLMs',/\bllm|language model|gpt|claude|gemini|llama|mistral|qwen|deepseek|transformer|token/i],
    ['Spreadsheets',/\bexcel|spreadsheet|google sheets|formula|csv\b/i],['Local AI',/\blocal(ly)?\b|offline|on-device|self-host|ollama|gguf/i],
    ['Security',/\bsecurity|injection|jailbreak|attack|privacy/i],['Careers',/\bcareer|job|interview|resume|learn(ing)? path|course/i],
    ['Research',/\bpaper|arxiv|research|benchmark|study/i],['Tools',/\btool|app|extension|plugin|platform/i]
  ];
  var TYPES=['Repo','Article','Blog','Cheatsheet','Prompt pack','Tool','Answer'];
  function tagsFor(text){ var t=[]; TOPICS.forEach(function(p){ if(p[1].test(text)) t.push(p[0]); }); return t.slice(0,4); }
  function siteOf(url){ try{ return new URL(url,location.href).hostname.replace(/^www\./,''); }catch(e){ return ''; } }
  function typeOf(url,fallback){
    var h=siteOf(url), p='';
    try{ p=new URL(url,location.href).pathname; }catch(e){}
    if(/github\.com$/.test(h)&&/^\/[^/]+\/[^/]+\/?$/.test(p)) return 'Repo';
    if(/airadar08\.github\.io$/.test(h)){ if(/cheatsheets/.test(p)) return 'Cheatsheet'; if(/prompt/.test(p)) return 'Prompt pack'; if(/repos/.test(p)) return 'Repo'; }
    if(/medium\.com|substack\.com|dev\.to|hashnode|blogspot|wordpress/.test(h)||/\/blog\//.test(p)||/^blog\./.test(h)) return 'Blog';
    if(/huggingface\.co$/.test(h)||/chrome\.google\.com|apps\.apple\.com|play\.google\.com|producthunt\.com/.test(h)) return 'Tool';
    return fallback||'Article';
  }

  /* ---------------- text helpers ---------------- */
  var STOP=new Set("a an the is are was were be been what whats which who how why when where do does did any some about from of for on in at to with and or but me my i you your tell give show find list get need want best top good great cool new newest latest recent popular trending hot right now today currently current this week month year ai please can could would should there their it its using use used help explain simple simply words word into like vs versus more most much many make makes made one two three four five six seven eight nine ten repo repos repository repositories github open source opensource project projects tool tools library libraries app apps something things thing saved save bookmarked ago last before earlier previous we did that those these".split(" "));
  var SYN={audio:['voice','speech','tts','sound','music','transcri','dubb'],voice:['audio','speech','tts'],speech:['voice','audio','tts','transcri'],music:['audio','sound'],
    image:['vision','photo','diffusion','picture'],images:['image','vision','diffusion'],video:['film','animation'],code:['coding','developer','programming'],coding:['code','developer'],
    agent:['agents','agentic'],agents:['agent','agentic'],local:['offline','locally','self-host','on-device'],prompt:['prompts','prompting'],prompts:['prompt','prompting'],
    rag:['retrieval'],llm:['model','language'],excel:['spreadsheet','sheets'],spreadsheet:['excel','sheets'],spreadsheets:['excel','sheets','spreadsheet']};
  function terms(q){ return q.toLowerCase().replace(/[^a-z0-9\s\-]/g,' ').split(/\s+/).filter(function(w){ return w.length>1&&!STOP.has(w)&&!/^\d+$/.test(w); }); }
  function has(text,w){ return w.length<=3?new RegExp('(^|[^a-z0-9])'+w.replace(/[^a-z0-9]/g,'')+'([^a-z0-9]|$)').test(text):text.indexOf(w)>=0; }
  function hit(text,w){ return [w].concat(SYN[w]||[]).some(function(x){ return has(text,x); }); }
  function kfmt(n){ return n>=1000?(n/1000).toFixed(n>=10000?0:1).replace(/\.0$/,'')+'k':String(n); }
  function fmtDate(iso){ try{ return new Date(iso).toLocaleDateString(undefined,{day:'numeric',month:'short',year:'numeric'}); }catch(e){ return iso; } }
  function fmtAnswer(s){
    var out=esc(s).replace(/\*\*(.+?)\*\*/g,'$1').replace(/^#+\s*/gm,'');
    out=out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
    return out;
  }
  function withTimeout(p,ms){ return Promise.race([p,new Promise(function(_,rej){ setTimeout(function(){ rej(new Error('timeout')); },ms); })]); }

  /* ---------------- 1. AI Radar resources ---------------- */
  var indexP=null;
  function loadIndex(){
    if(indexP) return indexP;
    function get(u,t){ return fetch(ROOT+u,{cache:'no-cache'}).then(function(r){ return r.ok?(t?r.text():r.json()):(t?'':[]); }).catch(function(){ return t?'':[]; }); }
    indexP=Promise.all([get('data/repos.json'),get('data/packs.json'),get('cheatsheets/',1)]).then(function(res){
      var items=[];
      (res[0]||[]).forEach(function(r){ items.push({type:'Repo',title:r.repo,desc:r.tagline||'',img:r.img?ROOT+r.img:'',url:ROOT+'repos/#'+r.slug,site:'AI Radar',
        text:[r.repo,r.tagline,(r.what||[]).join(' '),r.read,r.language].join(' ').toLowerCase(),meta:r.stars?'★ '+r.stars+(r.language?' · '+r.language:''):''}); });
      (res[1]||[]).forEach(function(k){ items.push({type:'Prompt pack',title:k.title,desc:k.desc||'',img:k.cover?ROOT+k.cover:'',url:ROOT+k.url,site:'AI Radar',
        text:[k.title,k.desc,k.keyword,'prompt prompts prompting pack'].join(' ').toLowerCase()}); });
      if(res[2]){ try{
        var doc=new DOMParser().parseFromString(res[2],'text/html');
        doc.querySelectorAll('article.sheet[id]').forEach(function(a){
          var b=a.querySelector('.meta b'), d=a.querySelector('.meta .desc'), k=a.querySelector('.meta .kind'), im=a.querySelector('img');
          var t=b?b.textContent.trim():a.id;
          items.push({type:'Cheatsheet',title:t,desc:d?d.textContent.trim():'',img:im?ROOT+'cheatsheets/'+im.getAttribute('src'):'',url:ROOT+'cheatsheets/#'+a.id,site:'AI Radar',
            text:[t,d&&d.textContent,k&&k.textContent,im&&im.alt,a.id.replace(/-/g,' '),'cheatsheet'].join(' ').toLowerCase()});
        });
      }catch(e){} }
      return items;
    });
    return indexP;
  }
  function matchResources(q,items){
    var base=terms(q); if(!base.length) return [];
    var want=/cheat ?sheets?/i.test(q)?'Cheatsheet':/prompt ?packs?|prompts?\b/i.test(q)?'Prompt pack':/\b(repos?|repositor(y|ies)|github)\b/i.test(q)?'Repo':'';
    return items.map(function(it){
      var s=0; base.forEach(function(w){ if(hit(it.text,w)) s++; });
      if(s&&want&&it.type===want) s+=.5;
      return {it:it,s:s};
    }).filter(function(x){ return x.s>=1; }).sort(function(a,b){ return b.s-a.s; }).slice(0,3).map(function(x){ return x.it; });
  }

  /* ---------------- 2. fresh sources ---------------- */
  var REPO_Q=/\b(repos?|repositor(y|ies)|github|open[- ]?source (projects?|tools?|models?|librar(y|ies)))\b/i;
  var NUMW={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
  var AIRX=/(\bai\b|llm|model|agent|neural|machine.learning|\bml\b|tts|asr|speech|voice|gpt|diffusion|generat|transformer|inference|whisper|\brag\b|vision|language|deep.learning|claude|openai|gemini|qwen|llama|mcp|prompt)/i;
  function daysAgo(n){ return new Date(Date.now()-n*864e5).toISOString().slice(0,10); }
  function gh(q){ return fetch('https://api.github.com/search/repositories?q='+encodeURIComponent(q)+'&sort=stars&order=desc&per_page=30',{headers:{Accept:'application/vnd.github+json'}}).then(function(r){ if(!r.ok) throw new Error('github '+r.status); return r.json(); }).then(function(j){ return j.items||[]; }); }
  function githubTop(q){
    var m=q.toLowerCase().match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\b/);
    var n=m?(NUMW[m[1]]||parseInt(m[1],10)):5; n=Math.max(1,Math.min(10,n||5));
    var kw=terms(q).slice(0,4), topic=kw.join(' ');
    function rel(i){ var hay=[i.full_name,i.description||'',(i.topics||[]).join(' ')].join(' ').toLowerCase();
      return kw.every(function(w){ return hit(hay,w); })&&AIRX.test(hay)&&!i.fork&&!i.archived; }
    return gh((topic?topic+' ':'')+'ai created:>'+daysAgo(180)).then(function(a){
      var picks=a.filter(rel);
      if(picks.length>=n) return picks.slice(0,n);
      return gh((topic?topic+' ':'')+'ai pushed:>'+daysAgo(30)+' stars:>500').then(function(b){
        var seen={}; return picks.concat(b.filter(rel)).filter(function(i){ if(seen[i.id]) return 0; return seen[i.id]=1; }).slice(0,n);
      });
    }).then(function(items){ return {topic:topic,items:items.map(function(i){
      return {type:'Repo',title:i.full_name,desc:i.description||'',url:i.html_url,site:'github.com',meta:'★ '+kfmt(i.stargazers_count)+(i.language?' · '+i.language:'')};
    })}; });
  }
  function hn(q){
    var kw=terms(q).slice(0,5).join(' '); if(!kw) return Promise.resolve([]);
    var since=Math.floor(Date.now()/1000)-365*86400;
    var url='https://hn.algolia.com/api/v1/search?tags=story&hitsPerPage=20&query='+encodeURIComponent(kw)+'&numericFilters=created_at_i>'+since;
    return fetch(url).then(function(r){ return r.ok?r.json():{hits:[]}; }).then(function(j){
      return (j.hits||[]).filter(function(h){ return h.url&&h.title&&AIRX.test(h.title+' '+(h.url||'')); })
        .sort(function(a,b){ return (b.points||0)-(a.points||0); }).slice(0,3)
        .map(function(h){ return {type:typeOf(h.url),title:h.title,url:h.url,site:siteOf(h.url),meta:(h.created_at?fmtDate(h.created_at):'')}; });
    }).catch(function(){ return []; });
  }
  var EXPAND={rag:'retrieval-augmented generation',llm:'large language model',llms:'large language model',mcp:'model context protocol',tts:'speech synthesis',asr:'speech recognition',
    gan:'generative adversarial network',rlhf:'reinforcement learning from human feedback',nlp:'natural language processing',cnn:'convolutional neural network',agents:'intelligent agent',agent:'intelligent agent',
    'fine-tuning':'fine-tuning (deep learning)',finetuning:'fine-tuning (deep learning)',transformer:'transformer (deep learning)',transformers:'transformer (deep learning)',embeddings:'word embedding',embedding:'word embedding'};
  function wiki(q){
    var tt=terms(q).slice(0,4); if(!tt.length) return Promise.resolve([]);
    var exp=tt.map(function(t){ return EXPAND[t]||t; });
    var kw=exp.join(' ');
    var url='https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&origin=*&srlimit=5&srsearch='+encodeURIComponent(kw);
    return fetch(url).then(function(r){ return r.ok?r.json():{}; }).then(function(j){
      var keys=exp.join(' ').toLowerCase().split(/\s+/).filter(function(w){ return w.length>2&&!/^(deep|learning\)?|the|and)$/.test(w); });
      return ((j.query&&j.query.search)||[]).filter(function(s){ var t=s.title.toLowerCase(); return AIRX.test(s.title+' '+s.snippet)&&keys.some(function(k){ return t.indexOf(k.replace(/[()]/g,''))>=0; }); }).slice(0,1).map(function(s){
        var d=s.snippet.replace(/<[^>]+>/g,'').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/&#039;/g,"'");
        return {type:'Article',title:s.title,desc:d,url:'https://en.wikipedia.org/wiki/'+encodeURIComponent(s.title.replace(/ /g,'_')),site:'wikipedia.org'};
      });
    }).catch(function(){ return []; });
  }
  function ai(history){
    var msgs=[]; history.forEach(function(m){ var role=m.role==='user'?'user':'assistant'; var c=m.role==='user'?m.text:(m.data&&m.data.answer)||m.text||''; if(!c) return;
      var last=msgs[msgs.length-1]; if(last&&last.role===role) last.content+='\n'+c; else msgs.push({role:role,content:c.slice(0,role==='user'?500:1500)}); });
    while(msgs.length&&msgs[msgs.length-1].role!=='user') msgs.pop();
    msgs=msgs.slice(-6); while(msgs.length&&msgs[0].role!=='user') msgs.shift();
    var body=JSON.stringify({messages:msgs});
    function once(){ return withTimeout(fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:body}),40000)
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(d){ d.ok=r.ok; d.status=r.status; return d; }); }); }
    // the free model is sometimes busy: retry once after a short pause
    return once().then(function(d){
      var bad=!d.ok||!d.reply||/^Sorry, I couldn't come up with an answer/.test(d.reply);
      if(!bad||d.status===429||d.status===400||d.status===403) return d;
      return new Promise(function(r){ setTimeout(r,1500); }).then(once);
    });
  }

  /* ---------------- 3. memory: ask for saved items ---------------- */
  var MEM_Q=/\b(i|we)\s+(have\s+|had\s+|just\s+)?(saved|bookmarked|stored|kept)\b|\b(did|have|had)\s+(i|we)\s+(save|saved|bookmark|bookmarked|keep|kept|store|stored)\b|\bmy\s+(saved|saves|library|bookmarks?)\b|\b(show|find|get|open|list)\b.*\bsaved\b|\bsaved\b.*\b(about|on|for|last|ago|year|month|week|before|earlier)\b|\b(in|from)\s+my\s+library\b/i;
  var MONTHS=['january','february','march','april','may','june','july','august','september','october','november','december'];
  function dateWindow(q){
    var s=q.toLowerCase(), now=new Date(), d0=null, d1=null, day=864e5;
    function startOf(unit,back){ var d=new Date(now); if(unit==='week'){ d.setDate(d.getDate()-((d.getDay()+6)%7)-7*back); } if(unit==='month'){ d=new Date(now.getFullYear(),now.getMonth()-back,1); } if(unit==='year'){ d=new Date(now.getFullYear()-back,0,1); } d.setHours(0,0,0,0); return d; }
    var m;
    if(/\btoday\b/.test(s)){ d0=new Date(now.toDateString()); }
    else if(/\byesterday\b/.test(s)){ d0=new Date(now.getTime()-day); d0.setHours(0,0,0,0); d1=new Date(now.toDateString()); }
    else if(/\bthis week\b/.test(s)){ d0=startOf('week',0); }
    else if(/\blast week\b/.test(s)){ d0=startOf('week',1); d1=startOf('week',0); }
    else if(/\bthis month\b/.test(s)){ d0=startOf('month',0); }
    else if(/\blast month\b/.test(s)){ d0=startOf('month',1); d1=startOf('month',0); }
    else if(/\bthis year\b/.test(s)){ d0=startOf('year',0); }
    else if(/\blast year\b/.test(s)){ d0=startOf('year',1); d1=startOf('year',0); }
    else if((m=s.match(/\b(\d+|a|an|one|two|three|four|five|six)\s+(day|week|month|year)s?\s+ago\b/))){
      var n=NUMW[m[1]]||(m[1]==='a'||m[1]==='an'?1:parseInt(m[1],10)); var span={day:1,week:7,month:30,year:365}[m[2]];
      var c=now.getTime()-n*span*day; d0=new Date(c-span*day*0.6); d1=new Date(c+span*day*0.6);
    }
    else if((m=s.match(/\b(20\d\d)\b/))){ d0=new Date(+m[1],0,1); d1=new Date(+m[1]+1,0,1); }
    if((m=s.match(new RegExp('\\b('+MONTHS.join('|')+')\\b')))&&!/\bmay i\b/.test(s)){
      var mi=MONTHS.indexOf(m[1]), y=(s.match(/\b(20\d\d)\b/)||[])[1]; y=y?+y:(mi>now.getMonth()?now.getFullYear()-1:now.getFullYear());
      d0=new Date(y,mi,1); d1=new Date(y,mi+1,1);
    }
    return {from:d0,to:d1};
  }
  function memorySearch(q){
    var s=q.toLowerCase(), w=dateWindow(q);
    var type=/\brepos?\b|repositor/.test(s)?'Repo':/cheat ?sheets?/.test(s)?'Cheatsheet':/prompt ?packs?/.test(s)?'Prompt pack':/\bblogs?\b/.test(s)?'Blog':/\barticles?\b/.test(s)?'Article':/\btools?\b/.test(s)?'Tool':/\banswers?\b/.test(s)?'Answer':'';
    var kw=terms(q).filter(function(t){ return MONTHS.indexOf(t)<0&&!/^(blogs?|articles?|cheatsheets?|packs?|answers?|show|find|yesterday)$/.test(t); });
    var found=library.filter(function(it){
      if(type&&it.type!==type) return false;
      var t=new Date(it.savedAt).getTime();
      if(w.from&&t<w.from.getTime()) return false;
      if(w.to&&t>=w.to.getTime()) return false;
      var hay=[it.title,it.desc,it.site,it.question,it.text,(it.tags||[]).join(' ')].join(' ').toLowerCase();
      return kw.every(function(k){ return hit(hay,k); });
    }).sort(function(a,b){ return b.savedAt<a.savedAt?-1:1; });
    return {items:found.slice(0,10),total:found.length,window:w,type:type,kw:kw};
  }

  /* ---------------- UI: chat ---------------- */
  var log=$('#log'), hello=$('#hello'), form=$('#composer'), input=$('#q'), send=$('#send'), viewChat=$('#view-chat');
  var busy=false;
  function scrollDown(){ viewChat.scrollTo({top:viewChat.scrollHeight,behavior:reduce?'auto':'smooth'}); }
  function isSaved(url){ return library.some(function(i){ return i.url&&i.url===url; }); }
  var BM='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"></path></svg>';

  function cardHTML(c,i,question){
    var lead=c.img?'<img class="thumb" src="'+esc(c.img)+'" alt="" loading="lazy">':'<span class="num">'+(i+1)+'</span>';
    var saved=isSaved(c.url);
    return '<div class="src">'+lead+'<a class="c" href="'+esc(c.url)+'"'+(/^https?:/.test(c.url)?' target="_blank" rel="noopener"':'')+' style="text-decoration:none"><span class="k">'+esc(c.type)+' · '+esc(c.site||siteOf(c.url))+'</span><b>'+esc(c.title)+'</b>'+(c.desc?'<span class="d">'+esc(c.desc)+'</span>':'')+(c.meta?'<span class="m">'+esc(c.meta)+'</span>':'')+'</a>'+
      '<button class="save'+(saved?' on':'')+'" type="button" aria-pressed="'+saved+'" aria-label="'+(saved?'Saved':'Save')+' '+esc(c.title)+'" data-card="'+esc(JSON.stringify({type:c.type,title:c.title,desc:c.desc||'',url:c.url,site:c.site||siteOf(c.url),meta:c.meta||'',question:question}))+'">'+BM+'</button></div>';
  }
  function group(title,list,question){ return list&&list.length?'<div class="group-h">'+esc(title)+'</div><div class="cards">'+list.map(function(c,i){ return cardHTML(c,i,question); }).join('')+'</div>':''; }

  function renderUser(text){ hello.hidden=true; var d=document.createElement('div'); d.className='msg me'; d.textContent=text; log.appendChild(d); scrollDown(); }
  function renderBot(data){
    hello.hidden=true;
    var d=document.createElement('div'); d.className='msg bot';
    var tag=data.kind==='memory'?'from your library':data.kind==='github'?'searched GitHub':data.web?'searched the web':'';
    var h='<div class="who"><img src="'+LOGO+'" alt="">AI Radar'+(tag?'<em>· '+tag+'</em>':'')+'</div>';
    if(data.answer) h+='<div class="answer'+(data.error?' err':'')+'">'+fmtAnswer(data.answer)+'</div>';
    if(data.kind==='memory'){
      h+=data.items.length?group('Saved items',data.items.map(function(it){ return {type:it.type,title:it.title,desc:it.type==='Answer'?(it.text||'').slice(0,160):it.desc,url:it.url||'#library',site:it.site||'',meta:'Saved '+fmtDate(it.savedAt)+(it.question?' · asked: '+it.question:'')}; }),data.question):'';
    }else{
      h+=group('On AI Radar',data.resources,data.question);
      h+=group(data.kind==='github'?'Top repos on GitHub right now':'Sources',data.sources,data.question);
    }
    if(data.answer&&data.canSave){
      var on=library.some(function(i){ return i.type==='Answer'&&i.question===data.question&&i.text===data.answer; });
      h+='<div class="row-actions"><button class="mini-btn save-answer'+(on?' on':'')+'" type="button">'+BM+(on?'Answer saved':'Save answer')+'</button></div>';
    }
    if(data.foot) h+='<div class="note">'+esc(data.foot)+'</div>';
    d.innerHTML=h; d._data=data; log.appendChild(d); scrollDown(); return d;
  }
  function typing(){ var d=document.createElement('div'); d.className='msg bot'; d.innerHTML='<div class="who"><img src="'+LOGO+'" alt="">AI Radar</div><span class="typing" aria-label="Thinking"><i></i><i></i><i></i></span>'; log.appendChild(d); scrollDown(); return d; }

  async function ask(q){
    q=q.trim(); if(!q||busy) return;
    busy=true; send.disabled=true;
    chat.push({role:'user',text:q}); renderUser(q); saveChat();
    var t=typing(), data;
    try{
      if(MEM_Q.test(q)){
        var r=memorySearch(q);
        var when=r.window.from?(' from '+fmtDate(r.window.from)+(r.window.to?' to '+fmtDate(new Date(r.window.to.getTime()-1)):'')):'';
        data={kind:'memory',question:q,items:r.items,canSave:false,
          answer:r.total?('Found '+r.total+' saved item'+(r.total>1?'s':'')+(r.kw.length?' about '+r.kw.join(' '):'')+when+(r.total>10?'. Showing the newest 10.':'.')):
            (library.length?'Nothing in your library matches that'+when+'. Try fewer words, or open the Library tab to browse with filters.':'Your library is empty. Tap the bookmark on any answer, repo or source to save it here.')};
      }else{
        var isRepo=REPO_Q.test(q);
        var resP=loadIndex().then(function(items){ return matchResources(q,items); }).catch(function(){ return []; });
        var srcP=isRepo?githubTop(q).then(function(g){ return g.items; }).catch(function(){ return null; }):Promise.all([hn(q),wiki(q)]).then(function(a){ return a[1].concat(a[0]); });
        var aiP=isRepo?Promise.resolve(null):ai(chat).catch(function(){ return {ok:false,error:"Couldn't reach the AI service. Check your connection and try again."}; });
        var res=await resP, src=await srcP, ans=await aiP;
        if(isRepo&&src===null){ isRepo=false; ans=await ai(chat).catch(function(){ return {ok:false}; }); src=[]; }
        var answer='', error=false, web=false;
        if(isRepo){
          answer=src.length?('Top '+src.length+(terms(q).slice(0,4).length?' '+terms(q).slice(0,4).join(' '):'')+' AI repos on GitHub right now, most-starred among those created in the last 6 months.'):'GitHub search returned nothing for that. Try a broader topic.';
        }else if(ans&&ans.ok&&ans.reply){
          answer=ans.reply; web=!!ans.web;
          (ans.sources||[]).forEach(function(s){ src.unshift({type:typeOf(s.url),title:s.title,url:s.url,site:s.label||siteOf(s.url)}); });
        }else{ answer=(ans&&ans.error)||'Something went wrong. Try again.'; error=true; }
        var offTopic=/\bonly (cover|help with|answer)\b[^.]*\bAI\b/i.test(answer);
        if(offTopic){ res=[]; src=[]; }
        var seen={}; src=(src||[]).filter(function(s){ if(!s.url||seen[s.url]) return false; return seen[s.url]=1; }).slice(0,isRepo?10:5);
        data={kind:isRepo?'github':'answer',question:q,answer:answer,error:error,resources:res,sources:src,web:web||(!isRepo&&src.length>0),canSave:!error&&!offTopic};
      }
    }catch(e){ data={kind:'answer',question:q,answer:'Something went wrong. Try again.',error:true,resources:[],sources:[]}; }
    t.remove(); renderBot(data); chat.push({role:'bot',data:data}); saveChat();
    busy=false; send.disabled=false;
  }

  // save buttons (cards + answers)
  log.addEventListener('click',function(e){
    var l=e.target.closest('a[href="#library"]'); if(l){ e.preventDefault(); switchTab('lib'); return; }
    var b=e.target.closest('.save');
    if(b){
      var c=JSON.parse(b.getAttribute('data-card'));
      if(c.url==='#library'){ switchTab('lib'); return; }
      var i=library.findIndex(function(x){ return x.url===c.url; });
      if(i>-1){ library.splice(i,1); saveLib(); toast('Removed from Library'); }
      else{ library.unshift({id:'s'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),type:c.type,title:c.title,desc:c.desc,url:c.url,site:c.site,meta:c.meta,question:c.question,tags:tagsFor([c.title,c.desc,c.question].join(' ')),savedAt:new Date().toISOString()}); saveLib(); toast('Saved to Library'); }
      syncSaveButtons(); return;
    }
    var sa=e.target.closest('.save-answer');
    if(sa){
      var data=sa.closest('.msg')._data;
      var j=library.findIndex(function(x){ return x.type==='Answer'&&x.question===data.question&&x.text===data.answer; });
      if(j>-1){ library.splice(j,1); toast('Removed from Library'); }
      else{ library.unshift({id:'a'+Date.now().toString(36),type:'Answer',title:data.question,text:data.answer,url:'',site:'AI Radar chat',question:data.question,
        sources:(data.resources||[]).concat(data.sources||[]).slice(0,6).map(function(s){ return {title:s.title,url:s.url}; }),
        tags:tagsFor(data.question+' '+data.answer),savedAt:new Date().toISOString()}); toast('Answer saved to Library'); }
      saveLib(); syncSaveButtons();
    }
  });
  function syncSaveButtons(){
    document.querySelectorAll('.save').forEach(function(b){ var c=JSON.parse(b.getAttribute('data-card')); var on=c.url==='#library'||isSaved(c.url); b.classList.toggle('on',on); b.setAttribute('aria-pressed',on); b.setAttribute('aria-label',(on?'Saved ':'Save ')+c.title); });
    document.querySelectorAll('.msg.bot').forEach(function(m){ var d=m._data, b=m.querySelector('.save-answer'); if(!d||!b) return;
      var on=library.some(function(i){ return i.type==='Answer'&&i.question===d.question&&i.text===d.answer; });
      b.classList.toggle('on',on); b.innerHTML=BM+(on?'Answer saved':'Save answer'); });
  }

  form.addEventListener('submit',function(e){ e.preventDefault(); var v=input.value; input.value=''; input.style.height=''; ask(v); });
  input.addEventListener('keydown',function(e){ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); form.requestSubmit(); } });
  input.addEventListener('input',function(){ input.style.height='auto'; input.style.height=Math.min(input.scrollHeight,130)+'px'; });
  $('#starter').addEventListener('click',function(e){ var c=e.target.closest('.chip'); if(c) ask(c.textContent); });
  $('#clear').addEventListener('click',function(){ chat=[]; saveChat(); log.innerHTML=''; hello.hidden=false; switchTab('chat'); input.focus(); });

  // restore the last conversation
  chat.forEach(function(m){ if(m.role==='user') renderUser(m.text); else if(m.data) renderBot(m.data); });

  /* ---------------- UI: library ---------------- */
  var fType='All', fDate='all', fTags=new Set(), q='';
  var DATES=[['all','All time'],['week','This week'],['month','This month'],['year','This year'],['custom','Custom']];
  function inRange(iso){
    var t=new Date(iso), now=new Date();
    if(fDate==='week'){ var w=new Date(now); w.setDate(now.getDate()-((now.getDay()+6)%7)); w.setHours(0,0,0,0); return t>=w; }
    if(fDate==='month') return t>=new Date(now.getFullYear(),now.getMonth(),1);
    if(fDate==='year') return t>=new Date(now.getFullYear(),0,1);
    if(fDate==='custom'){ var a=$('#d-from').value, b=$('#d-to').value; if(a&&t<new Date(a+'T00:00:00')) return false; if(b&&t>new Date(b+'T23:59:59')) return false; }
    return true;
  }
  function renderFilters(){
    $('#f-type').innerHTML=['All'].concat(TYPES).map(function(x){ return '<button class="f'+(fType===x?' on':'')+'" type="button" data-type="'+x+'" aria-pressed="'+(fType===x)+'">'+x+'</button>'; }).join('');
    $('#f-date').innerHTML=DATES.map(function(d){ return '<button class="f'+(fDate===d[0]?' on':'')+'" type="button" data-date="'+d[0]+'" aria-pressed="'+(fDate===d[0])+'">'+d[1]+'</button>'; }).join('');
    $('#f-custom').hidden=fDate!=='custom';
    var tags={}; library.forEach(function(i){ (i.tags||[]).forEach(function(t){ tags[t]=(tags[t]||0)+1; }); });
    var keys=Object.keys(tags).sort(function(a,b){ return tags[b]-tags[a]; });
    $('#f-tag').innerHTML=keys.map(function(t){ var on=fTags.has(t); return '<button class="f tag'+(on?' on':'')+'" type="button" data-tag="'+esc(t)+'" aria-pressed="'+on+'">#'+esc(t)+' <span style="opacity:.6">'+tags[t]+'</span></button>'; }).join('');
    $('#f-tag').hidden=!keys.length;
  }
  function renderLibrary(){
    renderFilters();
    var words=terms(q);
    var list=library.filter(function(i){
      if(fType!=='All'&&i.type!==fType) return false;
      if(!inRange(i.savedAt)) return false;
      if(fTags.size&&!(i.tags||[]).some(function(t){ return fTags.has(t); })) return false;
      if(words.length){ var hay=[i.title,i.desc,i.site,i.question,i.text,(i.tags||[]).join(' ')].join(' ').toLowerCase(); if(!words.every(function(w){ return hit(hay,w); })) return false; }
      return true;
    });
    $('#lib-count').textContent=library.length?(list.length===library.length?library.length+' saved':list.length+' of '+library.length):'';
    if(!library.length){ $('#items').innerHTML='<div class="empty"><b>Nothing saved yet</b>Tap the bookmark on any answer, repo or source in Chat to keep it here.</div>'; return; }
    if(!list.length){ $('#items').innerHTML='<div class="empty"><b>No matches</b>Try another filter or clear the search.</div>'; return; }
    $('#items').innerHTML=list.map(function(i){
      var link=i.url?'<a class="mini-btn" href="'+esc(i.url)+'" target="_blank" rel="noopener">Open</a>':'';
      var srcs=(i.sources||[]).filter(function(s){ return s.url; }).slice(0,4).map(function(s){ return '<a class="mini-btn" href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc((s.title||'').slice(0,32))+'</a>'; }).join('');
      return '<article class="item" data-id="'+esc(i.id)+'"><div class="t"><b>'+esc(i.title)+'</b><span class="type">'+esc(i.type)+'</span></div>'+
        (i.type==='Answer'?'<div class="body">'+esc(i.text)+'</div>':(i.desc?'<div class="q">'+esc(i.desc)+'</div>':''))+
        (i.tags&&i.tags.length?'<div class="tags">'+i.tags.map(function(t){ return '<span>#'+esc(t)+'</span>'; }).join('')+'</div>':'')+
        '<div class="meta"><span>Saved '+esc(fmtDate(i.savedAt))+'</span>'+(i.site?'<span>'+esc(i.site)+'</span>':'')+(i.meta?'<span>'+esc(i.meta)+'</span>':'')+'</div>'+
        (i.question&&i.type!=='Answer'?'<div class="q">From: “'+esc(i.question)+'”</div>':'')+
        '<div class="acts">'+link+(i.type==='Answer'?'<button class="mini-btn more" type="button">Show all</button>':'')+srcs+'<button class="mini-btn remove" type="button">Remove</button></div></article>';
    }).join('');
  }
  $('#view-lib').addEventListener('click',function(e){
    var b;
    if((b=e.target.closest('[data-type]'))){ fType=b.dataset.type; renderLibrary(); }
    else if((b=e.target.closest('[data-date]'))){ fDate=b.dataset.date; renderLibrary(); }
    else if((b=e.target.closest('[data-tag]'))){ var t=b.dataset.tag; fTags.has(t)?fTags.delete(t):fTags.add(t); renderLibrary(); }
    else if((b=e.target.closest('.remove'))){ var id=b.closest('.item').dataset.id; library=library.filter(function(i){ return i.id!==id; }); saveLib(); renderLibrary(); syncSaveButtons(); toast('Removed'); }
    else if((b=e.target.closest('.more'))){ var body=b.closest('.item').querySelector('.body'); body.classList.toggle('open'); b.textContent=body.classList.contains('open')?'Show less':'Show all'; }
  });
  $('#lib-q').addEventListener('input',function(e){ q=e.target.value; renderLibrary(); });
  $('#d-from').addEventListener('change',renderLibrary); $('#d-to').addEventListener('change',renderLibrary);

  /* ---------------- tabs, badge, toast ---------------- */
  function switchTab(name){
    document.querySelectorAll('.tab').forEach(function(t){ var on=t.dataset.tab===name; t.classList.toggle('on',on); if(on) t.setAttribute('aria-current','page'); else t.removeAttribute('aria-current'); });
    $('#view-chat').hidden=name!=='chat'; $('#view-lib').hidden=name!=='lib'; form.hidden=name!=='chat';
    if(name==='lib') renderLibrary(); else scrollDown();
    try{ history.replaceState(null,'',name==='lib'?'#library':'#'); }catch(e){}
  }
  document.querySelectorAll('.tab').forEach(function(t){ t.addEventListener('click',function(){ switchTab(t.dataset.tab); }); });
  function updateBadge(){ var b=$('#badge'); b.hidden=!library.length; b.textContent=library.length>99?'99+':library.length; }
  var tt; function toast(m){ var el=$('#toast'); el.textContent=m; el.classList.add('on'); clearTimeout(tt); tt=setTimeout(function(){ el.classList.remove('on'); },1700); }
  updateBadge();
  if(location.hash==='#library') switchTab('lib');

  /* ---------------- install + offline ---------------- */
  var deferred=null, inst=$('#install');
  window.addEventListener('beforeinstallprompt',function(e){ e.preventDefault(); deferred=e; inst.hidden=false; });
  inst.addEventListener('click',function(){ if(!deferred) return; deferred.prompt(); deferred.userChoice.finally(function(){ deferred=null; inst.hidden=true; }); });
  window.addEventListener('appinstalled',function(){ inst.hidden=true; toast('AI Radar installed'); });
  var standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
  if(/iphone|ipad|ipod/i.test(navigator.userAgent)&&!standalone) $('#ios-hint').hidden=false;
  if('serviceWorker' in navigator) window.addEventListener('load',function(){ navigator.serviceWorker.register('sw.js').catch(function(){}); });
  window.addEventListener('offline',function(){ toast("You're offline. Your Library still works."); });
})();
