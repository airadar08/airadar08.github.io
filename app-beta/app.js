// AI Radar app (beta). Chat with sources, save to an on-device library, filter it, and ask the chat for saved items.
// Answer pipeline: (1) the user's own library when they ask for something they saved,
// (2) AI Radar resources (repos, cheatsheets, prompt packs), (3) fresh sources: GitHub for repo questions,
// otherwise Hacker News stories + Wikipedia + the Worker's news headlines, plus the Worker's short AI answer.
(function(){
  'use strict';
  document.body.dataset.tab='chat';
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
  var COL_KEY='airadar-collections-v1';
  var collections=load(COL_KEY,[]);   // named lists of saved items; each item keeps its list names in item.cols
  function saveCols(){ store(COL_KEY,collections); }
  var chat=load(CHAT_KEY,[]);           // [{role:'user'|'bot', text, data}]
  function saveLib(){ if(!store(LIB_KEY,library)) toast("Couldn't save: storage is full or blocked"); updateBadge(); }
  function saveChat(){ store(CHAT_KEY,chat.slice(-40)); }
  // Chat sessions: after 5 minutes without a message the next question starts a fresh conversation for the AI
  // (a "New conversation" divider marks it); within a session the AI sees up to CTX_MAX messages.
  var SESSION_MS=5*60*1000, CTX_MAX=12;
  function lastChatTime(){ for(var i=chat.length-1;i>=0;i--){ if(chat[i].role!=='divider') return chat[i].t||0; } return 0; }
  function sessionChat(){ var start=0; for(var i=chat.length-1;i>=0;i--){ if(chat[i].role==='divider'){ start=i+1; break; } } return chat.slice(start).filter(function(m){ return m.role!=='divider'; }); }

  /* ---------------- topics, types ---------------- */
  // Topics are assigned automatically from the title, description, note and (for repos) GitHub topics.
  var TOPICS=[
    ['Local LLMs',/ollama|llama[.\-_ ]?cpp|\bgguf\b|lm ?studio|llamafile|\blocalai\b|\bmlx\b|exllama|\bvllm\b|koboldcpp|gpt4all|jan\.ai|text-generation-webui|open ?webui|on-device|run(s|ning)? (\w+ )?(llms?|models?|ai) (locally|offline)|(locally|offline) on your|on your (own )?(pc|computer|laptop|mac|machine|gpu|phone)|local (llms?|models?|ai|inference|chat)|self-?host(ed|ing)? (llms?|models?|ai)|quantiz/i],
    ['Agents',/\bagents?\b|agentic|autonomous|tool[- ]use|function calling|browser use|computer use|crewai|autogen|langgraph/i],
    ['MCP',/\bmcp\b|model context protocol/i],
    ['RAG',/\brag\b|retrieval|vector (db|database|store|search)|embeddings?|semantic search|knowledge base|chunking|rerank/i],
    ['Coding',/\bcod(e|ing|er)\b|developer|programming|\bide\b|copilot|cursor|claude code|codex|devtools?|software engineer|vibe cod/i],
    ['Image',/\bimages?\b|vision|photos?|diffusion|picture|text-to-image|midjourney|flux|comfyui|stable diffusion|\bocr\b/i],
    ['Video',/\bvideos?\b|film|animation|\bsora\b|\bveo\b|runway|text-to-video|youtube/i],
    ['Audio & Voice',/\baudio|voice|speech|\btts\b|\basr\b|whisper|music|sound|podcast|dubb|transcri/i],
    ['Prompts',/\bprompt/i],
    ['Spreadsheets',/\bexcel|spreadsheets?|google sheets|formulas?|\bcsv\b|pivot table/i],
    ['Fine-tuning',/fine[- ]?tun|\blora\b|qlora|\bpeft\b|\brlhf\b|\bdpo\b|unsloth|axolotl|distill/i],
    ['Datasets',/\bdatasets?\b|training data|benchmark data|corpus|annotation|synthetic data/i],
    ['Security',/securit|injection|jailbreak|red[- ]team|attack|privacy|malware|guardrail/i],
    ['Learning',/\bcourses?\b|tutorials?|learn (ai|to|how|the)|learning path|\bguide\b|roadmap|cheat ?sheet|explained|beginners?|lectures?|handbook|from scratch/i],
    ['Careers',/career|\bjobs?\b|interview|resume|hiring|salary|portfolio/i],
    ['LLMs',/\bllms?\b|language models?|\bgpt|claude|gemini|llama|mistral|qwen|deepseek|kimi|grok|transformer/i],
    ['Research',/\bpapers?\b|arxiv|research|study|preprint/i]
  ];
  var TOPIC_KEY='airadar-topics-v1';
  var customTopics=load(TOPIC_KEY,[]);       // user-made topics ("Work project", "Try later")
  var OLD_TAG={'Local AI':'Local LLMs','Audio':'Audio & Voice','Images':'Image','Prompting':'Prompts','Tools':null};
  // types you can pick in the Add sheet; saved chat answers, posts and packs keep their own types
  var ADD_TYPES=['Repo','Article','Blog','Video','Tool','Model','Paper','Cheatsheet','Prompt','Course','Note'];
  var TYPES=ADD_TYPES.concat(['Post','Prompt pack','Answer']);
  function tagsFor(text){ var t=[]; TOPICS.forEach(function(p){ if(p[1].test(text)) t.push(p[0]); });
    // "Local LLMs" makes the generic "LLMs" redundant
    if(t.indexOf('Local LLMs')>-1) t=t.filter(function(x){ return x!=='LLMs'; });
    return t.slice(0,4); }
  function siteOf(url){ if(!url||/^#/.test(url)) return ''; try{ return new URL(url,location.href).hostname.replace(/^www\./,''); }catch(e){ return ''; } }
  function typeOf(url,fallback){
    var h=siteOf(url), p='';
    try{ p=new URL(url,location.href).pathname; }catch(e){}
    if(/(^|\.)github\.com$/.test(h)&&/^\/[^/]+\/[^/]+\/?$/.test(p)&&!/^\/(topics|orgs|sponsors|marketplace|settings|features|collections)\//.test(p)) return 'Repo';
    if(/airadar08\.github\.io$/.test(h)){ if(/cheatsheets/.test(p)) return 'Cheatsheet'; if(/prompt/.test(p)) return 'Prompt pack'; if(/repos/.test(p)) return 'Repo'; }
    if(/(^|\.)(youtube\.com|youtu\.be|vimeo\.com|loom\.com|twitch\.tv)$/.test(h)) return 'Video';
    if(/(^|\.)(x\.com|twitter\.com)$/.test(h)&&/\/status\//.test(p)) return 'Post';
    if(/huggingface\.co$/.test(h)){ if(/^\/(spaces)\//.test(p)) return 'Tool'; if(/^\/(datasets|docs|blog|learn|papers|posts)\b/.test(p)) return /^\/blog|^\/posts/.test(p)?'Blog':/^\/learn/.test(p)?'Course':/^\/papers/.test(p)?'Paper':'Article'; if(/^\/[^/]+\/[^/]+\/?$/.test(p)) return 'Model'; }
    if(/(^|\.)(ollama\.com)$/.test(h)&&/^\/library\//.test(p)) return 'Model';
    if(/(^|\.)(arxiv\.org|openreview\.net|aclanthology\.org|paperswithcode\.com|semanticscholar\.org|biorxiv\.org)$/.test(h)||/\.pdf$/i.test(p)) return 'Paper';
    if(/(^|\.)(coursera\.org|udemy\.com|edx\.org|udacity\.com|fast\.ai|deeplearning\.ai)$/.test(h)||/\/(courses?|learn)\//.test(p)) return 'Course';
    if(/medium\.com|substack\.com|dev\.to|hashnode|blogspot|wordpress|ghost\.io/.test(h)||/\/blog\//.test(p)||/^blog\./.test(h)) return 'Blog';
    if(/chrome\.google\.com|chromewebstore\.google\.com|apps\.apple\.com|play\.google\.com|producthunt\.com|marketplace\.visualstudio\.com/.test(h)) return 'Tool';
    return fallback||'Article';
  }
  // one key per link so the same page saved twice is updated, not duplicated
  function normUrl(u){
    if(!u) return '';
    try{ var x=new URL(/^[a-z]+:\/\//i.test(u)||/^#/.test(u)?u:'https://'+u,location.href);
      if(!/^https?:$/.test(x.protocol)) return u;
      ['utm_source','utm_medium','utm_campaign','utm_term','utm_content','ref','ref_src','s','t','si','fbclid','gclid'].forEach(function(k){ if(!(k==='t'&&/youtu/.test(x.hostname))) x.searchParams.delete(k); });
      var path=x.pathname.replace(/\/+$/,''); var host=x.hostname.replace(/^(www|m|mobile)\./,'').toLowerCase();
      if(host==='youtu.be'){ host='youtube.com'; x.searchParams.set('v',path.slice(1)); path='/watch'; }
      if(host==='twitter.com') host='x.com';
      if(host==='github.com') path=path.toLowerCase().replace(/\.git$/,'');
      var qs=x.searchParams.toString();
      return host+path+(qs?'?'+qs:'')+(host.indexOf('airadar08')>-1?x.hash:'');   // our own resources use #slug anchors
    }catch(e){ return u; }
  }
  // migrate topics from the first beta
  (function(){ var changed=false;
    library.forEach(function(i){ if(!i.tags) return; var t=[];
      i.tags.forEach(function(x){ var n=Object.prototype.hasOwnProperty.call(OLD_TAG,x)?OLD_TAG[x]:x; if(n!==x) changed=true; if(n&&t.indexOf(n)<0) t.push(n); });
      i.tags=t; });
    if(changed) store(LIB_KEY,library); })();

  /* ---------------- text helpers ---------------- */
  var STOP=new Set("a an the is are was were be been what whats which who how why when where do does did any some about from of for on in at to with and or but me my i you your tell give show find list get need want best top good great cool new newest latest recent popular trending hot right now today currently current this week month year ai please can could would should there their it its using use used help explain simple simply words word into like vs versus more most much many make makes made one two three four five six seven eight nine ten repo repos repository repositories github open source opensource project projects tool tools library libraries app apps something things thing saved save bookmarked ago last before earlier previous we did that those these".split(" "));
  var SYN={audio:['voice','speech','tts','sound','music','transcri','dubb'],voice:['audio','speech','tts'],speech:['voice','audio','tts','transcri'],music:['audio','sound'],
    image:['vision','photo','diffusion','picture'],images:['image','vision','diffusion'],video:['film','animation'],code:['coding','developer','programming'],coding:['code','developer'],
    agent:['agents','agentic'],agents:['agent','agentic'],local:['offline','locally','self-host','on-device'],prompt:['prompts','prompting'],prompts:['prompt','prompting'],
    rag:['retrieval'],llm:['model','language'],excel:['spreadsheet','sheets'],spreadsheet:['excel','sheets'],spreadsheets:['excel','sheets','spreadsheet']};
  function terms(q){ return q.toLowerCase().replace(/[^a-z0-9\s\-]/g,' ').split(/\s+/).filter(function(w){ return w.length>1&&!STOP.has(w)&&!/^\d+$/.test(w); }); }
  function has(text,w){ return w.length<=3?new RegExp('(^|[^a-z0-9])'+w.replace(/[^a-z0-9]/g,'')+'s?([^a-z0-9]|$)').test(text):text.indexOf(w)>=0; }
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
      (res[0]||[]).forEach(function(r){ items.push({type:'Repo',title:r.repo,desc:r.tagline||'',img:r.img?ROOT+r.img:'',url:ROOT+'repos/#'+r.slug,site:'AI Radar',date:r.date||'',link:'repos/#'+r.slug,ext:r.url||'',stars:r.stars||'',lic:r.license||'',
        text:[r.repo,r.tagline,(r.what||[]).join(' '),r.read,r.language].join(' ').toLowerCase(),meta:r.stars?'★ '+r.stars+(r.language?' · '+r.language:''):''}); });
      (res[1]||[]).forEach(function(k){ items.push({type:'Prompt pack',title:k.title,desc:k.desc||'',img:k.cover?ROOT+k.cover:'',url:ROOT+k.url,site:'AI Radar',date:k.date||'',link:k.url,count:k.count||0,
        text:[k.title,k.desc,k.keyword,'prompt prompts prompting pack'].join(' ').toLowerCase()}); });
      if(res[2]){ try{
        var doc=new DOMParser().parseFromString(res[2],'text/html');
        doc.querySelectorAll('article.sheet[id]').forEach(function(a){
          var b=a.querySelector('.meta b'), d=a.querySelector('.meta .desc'), k=a.querySelector('.meta .kind'), im=a.querySelector('img');
          var t=b?b.textContent.trim():a.id;
          items.push({type:'Cheatsheet',title:t,desc:d?d.textContent.trim():'',img:im?ROOT+'cheatsheets/'+im.getAttribute('src'):'',url:ROOT+'cheatsheets/#'+a.id,site:'AI Radar',date:'',link:'cheatsheets/#'+a.id,cat:k?k.textContent.trim():'',
            text:[t,d&&d.textContent,k&&k.textContent,im&&im.alt,a.id.replace(/-/g,' '),'cheatsheet'].join(' ').toLowerCase()});
        });
      }catch(e){} }
      window.__airIndex=items; return items;
    });
    return indexP;
  }
  function matchResources(q,items){
    var base=ghTerms(q); if(!base.length) return [];   // same cleaning as repo search: no intent words, 'front end' -> frontend
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
  // Repo search: turn a question into a clean GitHub query.
  // "i want to create a good front end, provide me a good repo" -> topic:frontend, most-starred and still active,
  // plus a few new AI repos for the same topic. Questions that are about AI (agents, TTS, LLMs...) get AI repos.
  var GH_STOP=new Set("create creating build building built develop developing making provide recommend recommendation recommendations suggest suggestion suggestions looking look need needs want wants start starting learn learning some nice better awesome useful which should way ways kind type types help resource resources stuff anything everything work working simple easy quick also other really very just here our we us my mine".split(" "));
  var GH_PHRASE=[[/front[\s-]?ends?/g,'frontend'],[/back[\s-]?ends?/g,'backend'],[/full[\s-]?stack/g,'fullstack'],[/user interfaces?|\bui\s*\/\s*ux\b/g,'ui'],[/web ?sites?|web ?pages?/g,'website'],[/landing pages?/g,'landing'],[/next\.?js/g,'nextjs'],[/tailwind ?css/g,'tailwind'],[/node\.?js/g,'nodejs'],[/vue\.?js/g,'vue'],[/react\.?js/g,'react'],[/design systems?/g,'designsystem'],[/text[\s-]to[\s-]speech/g,'tts'],[/speech[\s-]to[\s-]text/g,'stt'],[/large language models?/g,'llm'],[/mobile apps?/g,'mobile'],[/chat ?bots?/g,'chatbot']];
  // words that work best as GitHub topics (the big projects tag themselves this way)
  var GH_TOPIC={frontend:'frontend',backend:'backend',fullstack:'fullstack',ui:'ui',css:'css',react:'react',vue:'vue',svelte:'svelte',angular:'angular',nextjs:'nextjs',tailwind:'tailwindcss',website:'website',landing:'landing-page',portfolio:'portfolio',dashboard:'dashboard',designsystem:'design-system',nodejs:'nodejs',mobile:'mobile',flutter:'flutter',android:'android',ios:'ios',agents:'ai-agents',agent:'ai-agents',mcp:'mcp',rag:'rag',tts:'tts',stt:'speech-to-text',llm:'llm',chatbot:'chatbot',ollama:'ollama',automation:'automation',scraping:'web-scraping',scraper:'web-scraping'};
  var GH_SYN={frontend:['frontend','front-end','ui','interface','design','component','css','react','vue','svelte'],ui:['ui','interface','design','component','css'],backend:['backend','api','server'],website:['website','site','landing','web page'],
    agents:['agent','agentic'],agent:['agent','agentic'],tts:['tts','speech','voice'],stt:['speech','transcri','asr','whisper'],llm:['llm','model','language'],chatbot:['chat','bot','assistant']};
  var GH_DEV=new Set('frontend backend fullstack ui css react vue svelte angular nextjs tailwind website landing portfolio dashboard designsystem nodejs mobile flutter android ios scraping scraper javascript typescript html'.split(' '));
  var AI_WORD=/\b(ai|ml|llms?|gpt|agents?|agentic|rag|mcp|tts|stt|asr|whisper|diffusion|neural|machine learning|deep learning|chatbot|ollama|transformers?|embeddings?|fine[- ]?tun\w*|prompts?|copilot|claude|gemini|openai|llama|qwen|deepseek|voice|speech|vision)\b/i;
  function ghTerms(q){
    var s=q.toLowerCase(); GH_PHRASE.forEach(function(p){ s=s.replace(p[0],p[1]); });
    return terms(s).filter(function(w){ return !GH_STOP.has(w)&&!/^(ai|ml)$/.test(w); }).slice(0,3);
  }
  function githubTop(q){
    var m=q.toLowerCase().match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten)\b/);
    var n=m?(NUMW[m[1]]||parseInt(m[1],10)):5; n=Math.max(1,Math.min(10,n||5));
    var kw=ghTerms(q), topic=kw.join(' ');
    // AI repos by default (this is an AI app); plain best-of repos only for software-building topics like frontend or websites
    var aiQ=AI_WORD.test(q)||!kw.length||!kw.some(function(w){ return GH_DEV.has(w); });
    var wantNew=/\b(trending|new|newest|latest|recent|fresh|hot|this (week|month)|right now)\b/i.test(q);
    var quals=kw.map(function(w){ return GH_TOPIC[w]?'topic:'+GH_TOPIC[w]:w; }).join(' ');
    var plain=kw.join(' ');
    function hay(i,withTopics){ return [i.full_name,i.description||'',withTopics?(i.topics||[]).join(' '):''].join(' ').toLowerCase(); }
    function onTopic(i,withTopics){ var h=hay(i,withTopics); return kw.every(function(w){ return [w].concat(GH_SYN[w]||SYN[w]||[]).some(function(x){ return has(h,x); }); }); }
    function ok(i){ return !i.fork&&!i.archived&&(!aiQ||AIRX.test(hay(i,true))); }
    function card(i){ return {type:'Repo',title:i.full_name,desc:i.description||'',url:i.html_url,site:'github.com',meta:'★ '+kfmt(i.stargazers_count)+(i.language?' · '+i.language:'')+' · updated '+fmtDate(i.pushed_at)}; }
    var ai=aiQ&&!/topic:ai-agents|topic:llm|topic:mcp|topic:rag/.test(quals)?' ai':'';
    var tries=wantNew
      ? [quals+ai+' created:>'+daysAgo(180), quals+ai+' pushed:>'+daysAgo(30)+' stars:>500', plain+ai+' stars:>100']
      : [quals+ai+' stars:>200 pushed:>'+daysAgo(120), quals+ai+' stars:>50', plain+ai+' stars:>50'];
    var picks=[], seen={};
    function run(k){
      if(k>=tries.length||picks.length>=n) return Promise.resolve();
      var qq=tries[k].trim(), viaTopic=/topic:/.test(qq);
      return gh(qq).then(function(a){
        a.forEach(function(i){ if(picks.length<n&&!seen[i.id]&&ok(i)&&(viaTopic||onTopic(i,true))){ seen[i.id]=1; picks.push(i); } });
      }).catch(function(e){ if(!picks.length&&k===0) throw e; }).then(function(){ return run(k+1); });
    }
    return run(0).then(function(){
      // a few brand-new AI repos for a non-AI topic ("frontend" -> AI UI builders, design skills for coding agents)
      if(aiQ||!plain) return [];
      return gh(plain+' ai created:>'+daysAgo(180)).then(function(a){
        return a.filter(function(i){ return !seen[i.id]&&!i.fork&&!i.archived&&AIRX.test(hay(i,true))&&onTopic(i,false); }).slice(0,3);
      }).catch(function(){ return []; });
    }).then(function(extra){
      return {topic:topic,aiQ:aiQ,fresh:wantNew,items:picks.map(card),extra:extra.map(card)};
    });
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
    var msgs=[]; history.filter(function(m){ return m.role!=='divider'; }).forEach(function(m){ var role=m.role==='user'?'user':'assistant'; var c=m.role==='user'?m.text:(m.data&&m.data.answer)||m.text||''; if(!c) return;
      var last=msgs[msgs.length-1]; if(last&&last.role===role) last.content+='\n'+c; else msgs.push({role:role,content:c.slice(0,role==='user'?500:1500)}); });
    while(msgs.length&&msgs[msgs.length-1].role!=='user') msgs.pop();
    msgs=msgs.slice(-CTX_MAX); while(msgs.length&&msgs[0].role!=='user') msgs.shift();
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
  var MEM_Q=/\b(i|we)\s+(have\s+|had\s+|just\s+)?(saved|bookmarked|stored|kept|added)\b|\b(did|have|had)\s+(i|we)\s+(save|saved|bookmark|bookmarked|keep|kept|store|stored)\b|\bmy\s+(saved|saves|library|bookmarks?)\b|\b(show|find|get|open|list)\b.*\bsaved\b|\bsaved\b.*\b(about|on|for|last|ago|year|month|week|before|earlier)\b|\b(in|from)\s+my\s+library\b/i;
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
  var TYPE_WORDS=[[/\brepos?\b|repositor/,'Repo'],[/cheat ?sheets?/,'Cheatsheet'],[/prompt ?packs?/,'Prompt pack'],[/\bprompts?\b/,'Prompt'],[/\bblogs?\b|blog posts?/,'Blog'],
    [/\barticles?\b/,'Article'],[/\bvideos?\b|youtube/,'Video'],[/\bmodels?\b/,'Model'],[/\bpapers?\b/,'Paper'],[/\bcourses?\b/,'Course'],[/\bnotes?\b/,'Note'],[/\btools?\b/,'Tool'],[/\banswers?\b/,'Answer'],[/\bposts?\b/,'Post']];
  function haystack(it){ return [it.title,it.desc,it.note,it.site,it.question,it.text,it.meta,it.url,(it.tags||[]).join(' ')].join(' ').toLowerCase(); }
  function memorySearch(q){
    var s=q.toLowerCase(), w=dateWindow(q), type='';
    TYPE_WORDS.some(function(t){ if(t[0].test(s)){ type=t[1]; return true; } });
    // "models" only means the Model type when it isn't part of "local models" / "language models"
    if(type==='Model'&&/(local|language|ai)\s+models?/.test(s)) type='';
    var qTopics=tagsFor(q).concat(customTopics.filter(function(t){ return s.indexOf(t.toLowerCase())>-1; }));
    var kw=terms(q).filter(function(t){ return MONTHS.indexOf(t)<0&&!/^(blogs?|articles?|cheatsheets?|packs?|answers?|show|find|yesterday|videos?|models?|papers?|courses?|notes?|prompts?|posts?|added|link|links)$/.test(t); });
    var found=library.filter(function(it){
      if(type&&it.type!==type&&!(type==='Prompt'&&it.type==='Prompt pack')) return false;
      var t=new Date(it.savedAt).getTime();
      if(w.from&&t<w.from.getTime()) return false;
      if(w.to&&t>=w.to.getTime()) return false;
      var hay=haystack(it);
      if(kw.every(function(k){ return hit(hay,k); })) return true;
      // topic match: "local LLM repo" finds items filed under Local LLMs even if the words differ
      return qTopics.length>0&&qTopics.every(function(tp){ return (it.tags||[]).indexOf(tp)>-1; });
    }).sort(function(a,b){ return b.savedAt<a.savedAt?-1:1; });
    return {items:found.slice(0,10),total:found.length,window:w,type:type,kw:kw};
  }

  /* ---------------- UI: chat ---------------- */
  var log=$('#log'), hello=$('#hello'), form=$('#composer'), input=$('#q'), send=$('#send'), viewChat=$('#view-chat');
  var busy=false;
  function scrollDown(){ viewChat.scrollTo({top:viewChat.scrollHeight,behavior:reduce?'auto':'smooth'}); }
  function isSaved(url){ var n=normUrl(url); return !!url&&library.some(function(i){ return i.url&&normUrl(i.url)===n; }); }
  var BM='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z"></path></svg>';

  function cardHTML(c,i,question){
    var lead=c.img?'<img class="thumb" src="'+esc(c.img)+'" alt="" loading="lazy">':'<span class="num">'+(i+1)+'</span>';
    var saved=isSaved(c.url);
    return '<div class="src">'+lead+'<a class="c" href="'+esc(c.url)+'"'+(/^https?:/.test(c.url)?' target="_blank" rel="noopener"':'')+' style="text-decoration:none"><span class="k">'+esc(c.type)+' · '+esc(c.site||siteOf(c.url))+'</span><b>'+esc(c.title)+'</b>'+(c.desc?'<span class="d">'+esc(c.desc)+'</span>':'')+(c.meta?'<span class="m">'+esc(c.meta)+'</span>':'')+'</a>'+
      '<button class="save'+(saved?' on':'')+'" type="button" aria-pressed="'+saved+'" aria-label="'+(saved?'Saved':'Save')+' '+esc(c.title)+'" data-card="'+esc(JSON.stringify({type:c.type,title:c.title,desc:c.desc||'',url:c.url,site:c.site||siteOf(c.url),meta:c.meta||'',question:question,img:c.img||'',tags:c.tags||[]}))+'">'+BM+'</button></div>';
  }
  function group(title,list,question){ return list&&list.length?'<div class="group-h">'+esc(title)+'</div><div class="cards">'+list.map(function(c,i){ return cardHTML(c,i,question); }).join('')+'</div>':''; }

  function renderDivider(){ var d=document.createElement('div'); d.className='divider'; d.textContent='New conversation'; log.appendChild(d); }
  function renderUser(text){ hello.hidden=true; var d=document.createElement('div'); d.className='msg me'; d.textContent=text; log.appendChild(d); scrollDown(); }
  function renderBot(data){
    hello.hidden=true;
    var d=document.createElement('div'); d.className='msg bot';
    var tag=data.kind==='memory'?'from your saved items':data.kind==='posts'?'from AI Radar posts':data.kind==='github'?'searched GitHub':data.web?'searched the web':'';
    var h='<div class="who"><img src="'+LOGO+'" alt="">AI Radar'+(tag?'<em>· '+tag+'</em>':'')+'</div>';
    if(data.answer) h+='<div class="answer'+(data.error?' err':'')+'">'+fmtAnswer(data.answer)+'</div>';
    if(data.kind==='posts'){
      h+=group('Our posts',data.items,data.question);
    }else if(data.kind==='memory'){
      h+=data.items.length?group('Saved items',data.items.map(function(it){ return {type:it.type,title:it.title,desc:it.type==='Answer'?(it.text||'').slice(0,160):(it.note?'Note: '+it.note+(it.desc?' · '+it.desc:''):it.desc),url:it.url||'#library',site:it.site||'',meta:'Saved '+fmtDate(it.savedAt)+(it.question?' · asked: '+it.question:'')}; }),data.question):'';
    }else{
      h+=group('On AI Radar',data.resources,data.question);
      h+=group(data.kind==='github'?'Top repos on GitHub':'Sources',data.sources,data.question);
      if(data.extra&&data.extra.length) h+=group('New AI repos for this',data.extra,data.question);
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
    if(chat.length&&Date.now()-lastChatTime()>SESSION_MS&&chat[chat.length-1].role!=='divider'){ chat.push({role:'divider',t:Date.now()}); renderDivider(); }
    chat.push({role:'user',text:q,t:Date.now()}); renderUser(q); saveChat();
    var t=typing(), data;
    try{
      if(POST_Q.test(q)&&!/\b(saved?|bookmark(ed)?)\b/i.test(q)){
        await loadPosts();
        var pr=postSearch(q);
        var pwhen=pr.window.from?(' from '+fmtDate(pr.window.from)+(pr.window.to?' to '+fmtDate(new Date(pr.window.to.getTime()-1)):'')):'';
        data={kind:'posts',question:q,items:pr.items.map(postAsCard),canSave:false,
          answer:pr.total?('Found '+pr.total+' AI Radar post'+(pr.total>1?'s':'')+(pr.kw.length?' about '+pr.kw.join(' '):'')+pwhen+(pr.total>10?'. Showing the newest 10.':'.')):
            ('No AI Radar post matches that'+pwhen+'. Try fewer words, or open the Posts tab to browse with filters.')};
      }else if(MEM_Q.test(q)){
        var r=memorySearch(q);
        var when=r.window.from?(' from '+fmtDate(r.window.from)+(r.window.to?' to '+fmtDate(new Date(r.window.to.getTime()-1)):'')):'';
        data={kind:'memory',question:q,items:r.items,canSave:false,
          answer:r.total?('Found '+r.total+' saved item'+(r.total>1?'s':'')+(r.kw.length?' about '+r.kw.join(' '):'')+when+(r.total>10?'. Showing the newest 10.':'.')):
            (library.length?'Nothing in your library matches that'+when+'. Try fewer words, or open the Saved tab to browse with filters.':'Nothing saved yet. Tap the bookmark on any answer or source, or the + button to add any link.')};
      }else{
        var isRepo=REPO_Q.test(q);
        var resP=Promise.all([loadIndex(),loadPosts()]).then(function(a){ return matchResources(q,a[0].concat(a[1].filter(function(p){ return p.type==='News'||p.type==='Fact'; }).map(postAsResource))); }).catch(function(){ return []; });
        var ghRes=null;
        var srcP=isRepo?githubTop(q).then(function(g){ ghRes=g; return g.items; }).catch(function(){ return null; }):Promise.all([hn(q),wiki(q)]).then(function(a){ return a[1].concat(a[0]); });
        var aiP=isRepo?Promise.resolve(null):ai(sessionChat()).catch(function(){ return {ok:false,error:"Couldn't reach the AI service. Check your connection and try again."}; });
        var res=await resP, src=await srcP, ans=await aiP;
        if(isRepo&&src===null){ isRepo=false; ans=await ai(sessionChat()).catch(function(){ return {ok:false}; }); src=[]; }
        var answer='', error=false, web=false;
        if(isRepo){
          var tp=ghRes&&ghRes.topic?' '+ghRes.topic:'', kind=ghRes&&ghRes.aiQ?' AI':'';
          answer=src.length?('Top '+src.length+tp+kind+' repos on GitHub'+(ghRes&&ghRes.fresh?', most-starred among those created in the last 6 months.':': most-starred and still actively updated.')+(ghRes&&ghRes.extra.length?' Plus new AI repos for'+tp+' below.':'')):'GitHub search returned nothing for that. Try a broader topic, e.g. "top repos for frontend".';
        }else if(ans&&ans.ok&&ans.reply){
          answer=ans.reply; web=!!ans.web;
          (ans.sources||[]).forEach(function(s){ src.unshift({type:typeOf(s.url),title:s.title,url:s.url,site:s.label||siteOf(s.url)}); });
        }else{ answer=(ans&&ans.error)||'Something went wrong. Try again.'; error=true; }
        var offTopic=/\bonly (cover|help with|answer)\b[^.]*\bAI\b/i.test(answer);
        if(offTopic){ res=[]; src=[]; }
        var seen={}; src=(src||[]).filter(function(s){ if(!s.url||seen[s.url]) return false; return seen[s.url]=1; }).slice(0,isRepo?10:5);
        data={kind:isRepo?'github':'answer',question:q,answer:answer,extra:isRepo&&ghRes?ghRes.extra:[],error:error,resources:res,sources:src,web:!offTopic&&(web||(!isRepo&&src.length>0)),canSave:!error&&!offTopic};
      }
    }catch(e){ data={kind:'answer',question:q,answer:'Something went wrong. Try again.',error:true,resources:[],sources:[]}; }
    t.remove(); renderBot(data); chat.push({role:'bot',data:data,t:Date.now()}); saveChat();
    busy=false; send.disabled=false;
  }

  // save buttons (cards + answers)
  function toggleSave(b){
    var c=JSON.parse(b.getAttribute('data-card'));
    if(c.url==='#library'){ switchTab('lib'); return; }
    var i=library.findIndex(function(x){ return x.url&&normUrl(x.url)===normUrl(c.url); });
    if(i>-1){ library.splice(i,1); saveLib(); toast('Removed from Saved'); }
    else{ library.unshift({id:'s'+Date.now().toString(36)+Math.random().toString(36).slice(2,6),type:c.type,title:c.title,desc:c.desc,url:c.url,site:c.site,meta:c.meta,question:c.question,img:c.img||'',
      tags:c.tags&&c.tags.length?c.tags:tagsFor([c.title,c.desc,c.question].join(' ')),savedAt:new Date().toISOString()}); saveLib(); toast('Saved'); }
    syncSaveButtons(); if(!$('#view-lib').hidden) renderLibrary();
  }
  log.addEventListener('click',function(e){
    var l=e.target.closest('a[href="#library"]'); if(l){ e.preventDefault(); switchTab('lib'); return; }
    var b=e.target.closest('.save');
    if(b){ toggleSave(b); return; }
    var sa=e.target.closest('.save-answer');
    if(sa){
      var data=sa.closest('.msg')._data;
      var j=library.findIndex(function(x){ return x.type==='Answer'&&x.question===data.question&&x.text===data.answer; });
      if(j>-1){ library.splice(j,1); toast('Removed from Saved'); }
      else{ library.unshift({id:'a'+Date.now().toString(36),type:'Answer',title:data.question,text:data.answer,url:'',site:'AI Radar chat',question:data.question,
        sources:(data.resources||[]).concat(data.sources||[]).slice(0,6).map(function(s){ return {title:s.title,url:s.url}; }),
        tags:tagsFor(data.question+' '+data.answer),savedAt:new Date().toISOString()}); toast('Answer saved'); }
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
  $('#clear').addEventListener('click',function(){ if(!$('#view-chat').hidden&&!chat.length){ input.focus(); return; } chat=[]; saveChat(); log.innerHTML=''; hello.hidden=false; switchTab('chat'); input.focus(); });

  // restore the last conversation
  chat.forEach(function(m){ if(m.role==='divider') renderDivider(); else if(m.role==='user') renderUser(m.text); else if(m.data) renderBot(m.data); });

  /* ---------------- UI: Saved (library) ---------------- */
  var fType='All', fDate='all', fTags=new Set(), fSite='', fCol='', sortBy='new', q='', pickOpen='';
  var DATES=[['all','All time'],['week','This week'],['month','This month'],['year','This year'],['custom','Custom']];
  function inRange(iso,mode,fromSel,toSel){
    mode=mode||fDate; fromSel=fromSel||'#d-from'; toSel=toSel||'#d-to';
    var t=new Date(iso), now=new Date(), fDate=mode;
    if(fDate==='week'){ var w=new Date(now); w.setDate(now.getDate()-((now.getDay()+6)%7)); w.setHours(0,0,0,0); return t>=w; }
    if(fDate==='month') return t>=new Date(now.getFullYear(),now.getMonth(),1);
    if(fDate==='year') return t>=new Date(now.getFullYear(),0,1);
    if(fDate==='custom'){ var a=$(fromSel).value, b=$(toSel).value; if(a&&t<new Date(a+'T00:00:00')) return false; if(b&&t>new Date(b+'T23:59:59')) return false; }
    return true;
  }
  function siteKey(i){ return i.site||siteOf(i.url)||''; }
  // does item i pass every filter except `skip` (so each filter row can show how many items it would leave)
  function passes(i,skip,words){
    if(skip!=='col'&&fCol&&(i.cols||[]).indexOf(fCol)<0) return false;
    if(skip!=='type'&&fType!=='All'&&i.type!==fType) return false;
    if(skip!=='date'&&!inRange(i.savedAt)) return false;
    if(skip!=='tag'&&fTags.size){ var tg=i.tags||[]; var ok=true; fTags.forEach(function(t){ if(tg.indexOf(t)<0) ok=false; }); if(!ok) return false; }
    if(skip!=='site'&&fSite&&siteKey(i)!==fSite) return false;
    if(words&&words.length){ var hay=haystack(i); if(!words.every(function(w){ return hit(hay,w); })) return false; }
    return true;
  }
  function chip(attr,val,label,on,n,cls){ return '<button class="f'+(cls?' '+cls:'')+(on?' on':'')+'" type="button" '+attr+'="'+esc(val)+'" aria-pressed="'+on+'">'+label+(n!=null?' <span class="n">'+n+'</span>':'')+'</button>'; }
  function renderFilters(words){
    var base=function(skip){ return library.filter(function(i){ return passes(i,skip,words); }); };
    var bt=base('type'), counts={}; bt.forEach(function(i){ counts[i.type]=(counts[i.type]||0)+1; });
    var types=TYPES.filter(function(t){ return counts[t]||fType===t; }).concat(Object.keys(counts).filter(function(t){ return TYPES.indexOf(t)<0; }));
    $('#f-type').innerHTML=chip('data-type','All','All types',fType==='All',bt.length)+types.map(function(x){ return chip('data-type',x,esc(x),fType===x,counts[x]||0); }).join('');
    var bd=base('date');
    $('#f-date').innerHTML=DATES.map(function(d){ var n=d[0]==='custom'?null:bd.filter(function(i){ return inRange(i.savedAt,d[0]); }).length; return chip('data-date',d[0],d[1],fDate===d[0],n); }).join('');
    $('#f-custom').hidden=fDate!=='custom';
    var bg=base('tag'), tags={};
    bg.forEach(function(i){ (i.tags||[]).forEach(function(t){ tags[t]=(tags[t]||0)+1; }); });
    fTags.forEach(function(t){ if(!tags[t]) tags[t]=0; });
    var keys=Object.keys(tags).sort(function(a,b){ return (fTags.has(b)-fTags.has(a))||tags[b]-tags[a]||a.localeCompare(b); });
    $('#f-tag').innerHTML=keys.map(function(t){ return chip('data-tag',t,'#'+esc(t),fTags.has(t),tags[t],'tag'); }).join('');
    $('#f-tag').hidden=!keys.length;
    var bs=base('site'), sites={};
    bs.forEach(function(i){ var k=siteKey(i); if(k) sites[k]=(sites[k]||0)+1; });
    var sk=Object.keys(sites).sort(function(a,b){ return sites[b]-sites[a]||a.localeCompare(b); }).slice(0,14);
    if(fSite&&sk.indexOf(fSite)<0) sk.unshift(fSite);
    $('#f-site').innerHTML=sk.length>1||fSite?chip('data-site','','All sites',!fSite,bs.length,'site')+sk.map(function(k){ return chip('data-site',k,esc(k),fSite===k,sites[k]||0,'site'); }).join(''):'';
    $('#f-site').hidden=!(sk.length>1||fSite);
    var bc=base('col');
    $('#f-col').innerHTML=chip('data-col','','All saved',!fCol,bc.length,'col')+collections.map(function(c){ return chip('data-col',c,'▤ '+esc(c),fCol===c,bc.filter(function(i){ return (i.cols||[]).indexOf(c)>-1; }).length,'col'); }).join('')+
      '<button class="f col new" type="button" data-newcol>+ New collection</button>';
    $('#col-tools').hidden=!fCol;
    if(fCol) $('#col-name').textContent=fCol;
    var any=fCol||fType!=='All'||fDate!=='all'||fTags.size||fSite||words.length;
    $('#f-clear').hidden=!any;
  }
  function renderLibrary(){
    var words=terms(q);
    renderFilters(words);
    var list=library.filter(function(i){ return passes(i,null,words); });
    list.sort(sortBy==='old'?function(a,b){ return a.savedAt<b.savedAt?-1:1; }:sortBy==='az'?function(a,b){ return (a.title||'').localeCompare(b.title||'',undefined,{sensitivity:'base'}); }:function(a,b){ return b.savedAt<a.savedAt?-1:1; });
    $('#lib-count').textContent=library.length?(list.length===library.length?library.length+' saved':list.length+' of '+library.length):'';
    $('#lib-tools').hidden=!library.length;
    if(!library.length){ $('#items').innerHTML='<div class="empty"><b>Nothing saved yet</b>Tap <span class="plus-i">+</span> to add any link or note, or the bookmark on any answer, source or post.<button class="pill-btn mint" type="button" data-add style="margin-top:10px">+ Add a link</button></div>'; return; }
    if(!list.length){ $('#items').innerHTML='<div class="empty"><b>No matches</b>Try another filter or clear the search.</div>'; return; }
    $('#items').innerHTML=list.map(function(i){
      var web=i.url&&/^https?:/.test(i.url);
      var link=web?'<a class="mini-btn" href="'+esc(i.url)+'" target="_blank" rel="noopener">'+(/x\.com\/ai_radar_\/status/.test(i.url)?'View on X':'Open')+'</a>':'';
      var srcs=(i.sources||[]).filter(function(s){ return s.url; }).slice(0,4).map(function(s){ return '<a class="mini-btn" href="'+esc(s.url)+'" target="_blank" rel="noopener">'+esc((s.title||'').slice(0,32))+'</a>'; }).join('');
      return '<article class="item" data-id="'+esc(i.id)+'">'+(i.img?'<img src="'+esc(i.img)+'" alt="" loading="lazy" style="width:100%;max-height:180px;object-fit:cover;object-position:top;border-radius:10px">':'')+'<div class="t"><b>'+esc(i.title)+'</b><span class="type">'+esc(i.type)+'</span></div>'+
        (i.type==='Answer'?'<div class="body">'+esc(i.text)+'</div>':(i.desc?'<div class="q">'+esc(i.desc)+'</div>':''))+
        (i.note&&i.note!==i.title?'<div class="note-box">'+esc(i.note)+'</div>':'')+
        (i.tags&&i.tags.length?'<div class="tags">'+i.tags.map(function(t){ return '<button type="button" data-tag="'+esc(t)+'">#'+esc(t)+'</button>'; }).join('')+'</div>':'')+
        ((i.cols||[]).length?'<div class="in-cols">'+i.cols.map(function(c){ return '<button type="button" data-col="'+esc(c)+'">▤ '+esc(c)+'</button>'; }).join('')+'</div>':'')+
        '<div class="meta"><span>Saved '+esc(fmtDate(i.savedAt))+'</span>'+(siteKey(i)?'<span>'+esc(siteKey(i))+'</span>':'')+(i.meta?'<span>'+esc(i.meta)+'</span>':'')+'</div>'+
        (i.question&&i.type!=='Answer'?'<div class="q">From: “'+esc(i.question)+'”</div>':'')+
        '<div class="acts">'+link+'<button class="mini-btn askit" type="button">Ask about this</button>'+(i.type==='Answer'?'<button class="mini-btn more" type="button">Show all</button>':'')+srcs+
        '<button class="mini-btn colbtn'+((i.cols||[]).length?' on':'')+'" type="button" aria-expanded="'+(pickOpen===i.id)+'">Collections</button>'+
        '<button class="mini-btn edit" type="button">Edit</button>'+
        (web?'<button class="mini-btn copy" type="button">Copy link</button>':'')+
        '<button class="mini-btn share" type="button">Share</button>'+
        '<button class="mini-btn remove" type="button">Delete</button></div>'+(pickOpen===i.id?pickerHTML(i):'')+'</article>';
    }).join('');
  }
  function pickerHTML(i){
    var mine=i.cols||[];
    return '<div class="col-pick"><span class="lbl">Add to collection</span><div class="tags">'+collections.map(function(c){ var on=mine.indexOf(c)>-1; return '<button type="button" class="pick'+(on?' on':'')+'" data-pick="'+esc(c)+'" aria-pressed="'+on+'">'+(on?'✓ ':'')+esc(c)+'</button>'; }).join('')+
      '</div><form class="col-new"><input type="text" maxlength="40" placeholder="New collection name" aria-label="New collection name"><button class="mini-btn" type="submit">Add</button></form></div>';
  }
  function cleanCol(n){ return (n||'').replace(/\s+/g,' ').trim().slice(0,40); }
  function addCollection(n){ n=cleanCol(n); if(!n) return ''; var hit=collections.find(function(c){ return c.toLowerCase()===n.toLowerCase(); }); if(hit) return hit; collections.push(n); saveCols(); return n; }
  function toggleIn(item,c,force){ var cs=(item.cols||[]).slice(), k=cs.indexOf(c); if(k>-1&&force!==true) cs.splice(k,1); else if(k<0&&force!==false) cs.push(c); item.cols=cs; saveLib(); }
  function askAbout(i){
    var q=i.type==='Repo'?'What does '+i.title+' do, and how do I get started with it?':
      i.type==='Answer'?'Tell me more about: '+(i.question||i.title):
      'Explain "'+i.title+'"'+(i.desc?' ('+i.desc.slice(0,160)+')':'')+' simply, and why it matters.';
    switchTab('chat'); ask(q);
  }
  // share a collection as a link: the items travel inside the link itself, nothing is uploaded
  function b64e(str){ var b=new TextEncoder().encode(str), s=''; b.forEach(function(x){ s+=String.fromCharCode(x); }); return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,''); }
  function b64d(str){ var s=atob(str.replace(/-/g,'+').replace(/_/g,'/')), b=new Uint8Array(s.length); for(var k=0;k<s.length;k++) b[k]=s.charCodeAt(k); return new TextDecoder().decode(b); }
  function shareCollection(name){
    var list=library.filter(function(i){ return (i.cols||[]).indexOf(name)>-1&&i.url&&/^https?:/.test(i.url); });
    if(!list.length){ toast('Add some links to this collection first'); return; }
    var data={n:name,i:list.slice(0,60).map(function(i){ return {t:(i.title||'').slice(0,140),u:i.url,y:i.type,d:(i.desc||'').slice(0,160)}; })};
    var url=location.origin+location.pathname+'#col='+b64e(JSON.stringify(data));
    if(url.length>12000){ toast('Too many items to share in one link'); return; }
    if(navigator.share) navigator.share({title:'AI Radar collection: '+name,url:url}).catch(function(e){ if(e&&e.name!=='AbortError') copyText(url); });
    else copyText(url);
  }
  function importSharedCollection(hash){
    var d; try{ d=JSON.parse(b64d(hash.slice(5))); }catch(e){ toast("That collection link is broken"); return; }
    var name=cleanCol(d&&d.n), items=Array.isArray(d&&d.i)?d.i:[];
    items=items.filter(function(x){ return x&&/^https?:\/\//.test(x.u||''); }).slice(0,60);
    if(!name||!items.length) return;
    if(!confirm('Add the collection "'+name+'" ('+items.length+' link'+(items.length===1?'':'s')+') to your Saved?')){ try{ history.replaceState(null,'',location.pathname); }catch(e){} return; }
    name=addCollection(name); var added=0;
    items.forEach(function(x){
      var n=normUrl(x.u), it=library.find(function(y){ return y.url&&normUrl(y.url)===n; });
      if(!it){ it={id:newId(),type:typeof x.y==='string'?x.y.slice(0,30):typeOf(x.u),title:String(x.t||x.u).slice(0,300),desc:String(x.d||'').slice(0,1200),note:'',url:x.u,site:siteOf(x.u),tags:tagsFor([x.t,x.d].join(' ')),savedAt:new Date().toISOString(),cols:[]}; library.unshift(it); added++; }
      it.cols=(it.cols||[]); if(it.cols.indexOf(name)<0) it.cols.push(name);
    });
    saveLib(); fCol=name; switchTab('lib'); syncSaveButtons();
    toast('Added '+added+' new, collection "'+name+'" ready');
  }
  function byId(id){ return library.find(function(i){ return i.id===id; }); }
  function copyText(t){
    function fallback(){ var a=document.createElement('textarea'); a.value=t; a.setAttribute('readonly',''); a.style.position='fixed'; a.style.opacity='0'; document.body.appendChild(a); a.select(); var ok=false; try{ ok=document.execCommand('copy'); }catch(e){} a.remove(); return ok; }
    var p=navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(t).then(function(){ return true; },fallback):Promise.resolve(fallback());
    return p.then(function(ok){ toast(ok?'Link copied':"Couldn't copy"); });
  }
  function shareItem(i){
    var text=i.type==='Answer'?(i.text||'').slice(0,600):(i.note||i.desc||'');
    var data={title:i.title}; if(text) data.text=text; if(i.url&&/^https?:/.test(i.url)) data.url=i.url;
    if(navigator.share){ navigator.share(data).catch(function(e){ if(e&&e.name!=='AbortError'&&data.url) copyText(data.url); }); return; }
    copyText(data.url||[i.title,text].join('\n'));
  }
  $('#view-lib').addEventListener('click',function(e){
    var b, it=e.target.closest('.item'), item=it&&byId(it.dataset.id);
    if((b=e.target.closest('[data-add]'))){ openSheet({}); }
    else if((b=e.target.closest('[data-type]'))){ fType=b.dataset.type; renderLibrary(); }
    else if((b=e.target.closest('[data-date]'))){ fDate=b.dataset.date; renderLibrary(); }
    else if((b=e.target.closest('[data-tag]'))){ var t=b.dataset.tag; if(b.closest('.item')){ fTags.add(t); } else { fTags.has(t)?fTags.delete(t):fTags.add(t); } renderLibrary(); if(b.closest('.item')) $('#view-lib').scrollTo({top:0,behavior:reduce?'auto':'smooth'}); }
    else if((b=e.target.closest('[data-site]'))){ fSite=b.dataset.site; renderLibrary(); }
    else if((b=e.target.closest('[data-newcol]'))){ var nm=addCollection(prompt('Name your collection (e.g. "My RAG stack")')); if(nm){ fCol=nm; renderLibrary(); toast('Collection created. Use "Collections" on any item to add it.'); } }
    else if((b=e.target.closest('[data-pick]'))&&item){ toggleIn(item,b.dataset.pick); renderLibrary(); }
    else if((b=e.target.closest('[data-col]'))){ fCol=b.dataset.col; pickOpen=''; renderLibrary(); if(b.closest('.item')) $('#view-lib').scrollTo({top:0,behavior:reduce?'auto':'smooth'}); }
    else if(e.target.closest('#col-share')){ shareCollection(fCol); }
    else if((b=e.target.closest('#col-del'))){
      if(!b.classList.contains('confirm')){ b.classList.add('confirm'); b.textContent='Tap again (items stay saved)'; setTimeout(function(){ if(b.isConnected){ b.classList.remove('confirm'); b.textContent='Delete collection'; } },3500); return; }
      var gone=fCol; collections=collections.filter(function(c){ return c!==gone; }); saveCols();
      library.forEach(function(i){ if(i.cols) i.cols=i.cols.filter(function(c){ return c!==gone; }); }); saveLib(); fCol=''; renderLibrary(); toast('Collection deleted');
    }
    else if(e.target.closest('#f-clear')){ fCol=''; fType='All'; fDate='all'; fTags.clear(); fSite=''; q=''; $('#lib-q').value=''; renderLibrary(); }
    else if(e.target.closest('#lib-export')){ exportLib(); }
    else if(e.target.closest('#lib-import')){ $('#import-file').click(); }
    else if(!item){ return; }
    else if((b=e.target.closest('.remove'))){
      if(!b.classList.contains('confirm')){ b.classList.add('confirm'); b.textContent='Tap again to delete'; setTimeout(function(){ if(b.isConnected){ b.classList.remove('confirm'); b.textContent='Delete'; } },3500); return; }
      library=library.filter(function(i){ return i.id!==item.id; }); saveLib(); renderLibrary(); syncSaveButtons(); toast('Deleted');
    }
    else if(e.target.closest('.askit')){ askAbout(item); }
    else if(e.target.closest('.colbtn')){ pickOpen=pickOpen===item.id?'':item.id; renderLibrary(); }
    else if(e.target.closest('.edit')){ openSheet({edit:item}); }
    else if(e.target.closest('.copy')){ copyText(item.url); }
    else if(e.target.closest('.share')){ shareItem(item); }
    else if((b=e.target.closest('.more'))){ var body=it.querySelector('.body'); body.classList.toggle('open'); b.textContent=body.classList.contains('open')?'Show less':'Show all'; }
  });
  $('#view-lib').addEventListener('submit',function(e){
    var f=e.target.closest('.col-new'); if(!f) return; e.preventDefault();
    var it=byId(f.closest('.item').dataset.id), nm=addCollection(f.querySelector('input').value);
    if(it&&nm){ toggleIn(it,nm,true); renderLibrary(); toast('Added to "'+nm+'"'); }
  });
  $('#lib-q').addEventListener('input',function(e){ q=e.target.value; renderLibrary(); });
  $('#lib-sort').addEventListener('change',function(e){ sortBy=e.target.value; renderLibrary(); });
  $('#d-from').addEventListener('change',renderLibrary); $('#d-to').addEventListener('change',renderLibrary);

  /* export / import (a JSON file you keep; nothing leaves the device otherwise) */
  function exportLib(){
    var data={app:'AI Radar',kind:'saved',version:1,exportedAt:new Date().toISOString(),topics:customTopics,collections:collections,items:library};
    var blob=new Blob([JSON.stringify(data,null,1)],{type:'application/json'});
    var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='ai-radar-saved-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(a); a.click(); setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },1000);
    toast('Exported '+library.length+' item'+(library.length===1?'':'s'));
  }
  function str(v,n){ return typeof v==='string'?v.slice(0,n||2000):''; }
  $('#import-file').addEventListener('change',function(e){
    var f=e.target.files&&e.target.files[0]; e.target.value=''; if(!f) return;
    if(f.size>8e6){ toast('That file is too big'); return; }
    f.text().then(function(txt){
      var d=JSON.parse(txt), items=Array.isArray(d)?d:(d&&d.items)||[], added=0, updated=0;
      if(!Array.isArray(items)) throw new Error('bad');
      (Array.isArray(d.topics)?d.topics:[]).forEach(function(t){ addCustomTopic(str(t,40),true); });
      (Array.isArray(d.collections)?d.collections:[]).forEach(function(c){ addCollection(str(c,40)); });
      items.forEach(function(x){
        if(!x||typeof x!=='object'||!(x.title||x.url||x.note||x.text)) return;
        var it={id:str(x.id,40)||newId(),type:str(x.type,30)||typeOf(x.url||''),title:str(x.title,300)||str(x.url,300)||'Untitled',desc:str(x.desc,1200),note:str(x.note,4000),
          url:str(x.url,2000),site:str(x.site,120),meta:str(x.meta,200),question:str(x.question,500),img:/^https?:\/\//.test(x.img||'')?str(x.img,2000):'',text:str(x.text,20000),
          sources:Array.isArray(x.sources)?x.sources.slice(0,8).map(function(s){ return {title:str(s&&s.title,200),url:/^https?:/.test(s&&s.url||'')?str(s.url,2000):''}; }):undefined,
          tags:Array.isArray(x.tags)?x.tags.map(function(t){ return str(t,40); }).filter(Boolean).slice(0,8):[],
          cols:Array.isArray(x.cols)?x.cols.map(function(c){ return addCollection(str(c,40)); }).filter(Boolean).slice(0,12):[],
          savedAt:!isNaN(Date.parse(x.savedAt))?new Date(x.savedAt).toISOString():new Date().toISOString()};
        if(!it.text) delete it.text; if(!it.sources) delete it.sources;
        var j=library.findIndex(function(y){ return y.id===it.id||(it.url&&normUrl(y.url)===normUrl(it.url)); });
        if(j>-1){ library[j]=Object.assign({},library[j],it,{id:library[j].id}); updated++; } else { library.push(it); added++; }
      });
      library.sort(function(a,b){ return b.savedAt<a.savedAt?-1:1; });
      saveLib(); renderLibrary(); syncSaveButtons();
      toast('Imported '+added+' new'+(updated?', updated '+updated:''));
    }).catch(function(){ toast("That isn't an AI Radar export file"); });
  });

  /* ---------------- Add to Saved sheet (+ button) ---------------- */
  var sheet=$('#sheet'), sh={};   // sh: state of the open sheet
  function newId(){ return 's'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
  function addCustomTopic(t,quiet){
    t=(t||'').replace(/^#/,'').replace(/\s+/g,' ').trim().slice(0,40); if(!t) return '';
    var all=TOPICS.map(function(p){ return p[0]; }).concat(customTopics);
    var ex=all.find(function(x){ return x.toLowerCase()===t.toLowerCase(); }); if(ex) return ex;
    customTopics.push(t); store(TOPIC_KEY,customTopics); if(!quiet) toast('Topic added'); return t;
  }
  function withScheme(u){ u=(u||'').trim(); if(!u) return ''; if(/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) return u; if(/^[\w-]+(\.[\w-]+)+(\/|$|\?|#)/.test(u)) return 'https://'+u; return u; }
  function validUrl(u){ try{ var x=new URL(u); return /^https?:$/.test(x.protocol)&&/\./.test(x.hostname); }catch(e){ return false; } }
  function titleFromUrl(u){
    try{ var x=new URL(u), seg=x.pathname.split('/').filter(Boolean);
      if(/github\.com$/.test(x.hostname)&&seg.length>=2) return seg[0]+'/'+seg[1];
      var last=decodeURIComponent(seg[seg.length-1]||'').replace(/\.(html?|php|aspx?|pdf)$/i,'').replace(/[-_+]+/g,' ').trim();
      if(last&&!/^\d+$/.test(last)&&last.length>2) return last.charAt(0).toUpperCase()+last.slice(1);
      return x.hostname.replace(/^www\./,'');
    }catch(e){ return u; }
  }
  function j(u,opt){ return withTimeout(fetch(u,opt),8000).then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); }); }
  // fetch details for a link: GitHub API for repos, Hugging Face API for models, noEmbed for videos, otherwise the Worker's page preview
  function lookup(url){
    var x; try{ x=new URL(url); }catch(e){ return Promise.reject(e); }
    var host=x.hostname.replace(/^www\./,''), seg=x.pathname.split('/').filter(Boolean);
    function viaWorker(){ return j(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'preview',url:url})})
      .then(function(d){ if(!d||!d.title) throw new Error('none'); return {title:d.title,desc:d.description||'',site:d.site||host,src:'page'}; }); }
    if(host==='github.com'&&seg.length>=2&&typeOf(url)==='Repo'){
      return j('https://api.github.com/repos/'+seg[0]+'/'+seg[1].replace(/\.git$/,''),{headers:{Accept:'application/vnd.github+json'}}).then(function(r){
        return {title:r.full_name,desc:r.description||'',site:'github.com',meta:'★ '+kfmt(r.stargazers_count||0)+(r.language?' · '+r.language:''),type:'Repo',
          extra:[(r.topics||[]).join(' '),r.language||'',r.homepage||''].join(' '),url:r.html_url,src:'GitHub'};
      });
    }
    if(host==='huggingface.co'&&seg.length>=2){
      var kind=seg[0]==='spaces'?'spaces':seg[0]==='datasets'?'datasets':(/^(docs|blog|learn|papers|posts|models|collections|organizations)$/.test(seg[0])?'':'models');
      if(kind){ var id=kind==='models'?seg[0]+'/'+seg[1]:seg[1]+'/'+(seg[2]||'');
        return j('https://huggingface.co/api/'+kind+'/'+id).then(function(r){
          var tags=(r.tags||[]).filter(function(t){ return !/^(region|license|arxiv|endpoints|autotrain|base_model|dataset):/.test(t); }).slice(0,12);
          var desc=kind==='models'?[r.pipeline_tag&&r.pipeline_tag.replace(/-/g,' '),r.library_name].filter(Boolean).join(' · '):(r.cardData&&r.cardData.title)||(r.sdk?r.sdk+' app':'');
          return {title:r.id||id,desc:desc?(kind==='models'?'Model: ':'')+desc:'',site:'huggingface.co',type:kind==='models'?'Model':kind==='spaces'?'Tool':'Article',
            meta:[r.likes!=null?'♥ '+kfmt(r.likes):'',r.downloads!=null?'↓ '+kfmt(r.downloads):''].filter(Boolean).join(' · '),extra:tags.join(' ')+(kind==='datasets'?' dataset':''),src:'Hugging Face'};
        }).catch(viaWorker);
      }
    }
    if(typeOf(url)==='Video'){
      return j('https://noembed.com/embed?url='+encodeURIComponent(url)).then(function(r){ if(!r||!r.title) throw new Error('none');
        return {title:r.title,desc:r.author_name?'By '+r.author_name:'',site:(r.provider_name||host).toLowerCase().replace(/\s+/g,'')==='youtube'?'youtube.com':host,img:r.thumbnail_url||'',type:'Video',src:r.provider_name||'video'};
      }).catch(viaWorker);
    }
    return viaWorker();
  }
  function allTopicNames(){ return TOPICS.map(function(p){ return p[0]; }).concat(customTopics); }
  function sheetText(){ return [$('#add-title').value,$('#add-note').value,sh.desc||'',sh.extra||'',$('#add-url').value].join(' '); }
  function suggest(){
    sh.suggested=tagsFor(sheetText());
    if(!sh.tagsTouched) sh.tags=new Set(sh.suggested);
    renderSheetTopics();
  }
  function renderSheetTopics(){
    var names=allTopicNames(), sug=sh.suggested||[];
    names.sort(function(a,b){ return (sh.tags.has(b)-sh.tags.has(a))||((sug.indexOf(b)>-1)-(sug.indexOf(a)>-1)); });
    sh.tags.forEach(function(t){ if(names.indexOf(t)<0) names.unshift(t); });
    $('#add-topics').innerHTML=names.map(function(t){ var on=sh.tags.has(t); return '<button class="f tag'+(on?' on':'')+'" type="button" data-topic="'+esc(t)+'" aria-pressed="'+on+'">'+(on?'✓ ':'')+esc(t)+'</button>'; }).join('');
  }
  function renderSheetTypes(){
    var cur=sh.type||'Article';
    var list=ADD_TYPES.slice(); if(list.indexOf(cur)<0) list.unshift(cur);
    $('#add-types').innerHTML=list.map(function(t){ return '<button class="f'+(cur===t?' on':'')+'" type="button" data-atype="'+esc(t)+'" aria-pressed="'+(cur===t)+'">'+esc(t)+'</button>'; }).join('');
  }
  function renderPreview(){
    var p=$('#add-preview');
    var bits=[sh.site,sh.meta].filter(Boolean).join(' · ');
    if(!sh.desc&&!bits){ p.hidden=true; return; }
    p.hidden=false; p.innerHTML=(sh.img?'<img src="'+esc(sh.img)+'" alt="">':'')+'<div>'+(bits?'<span class="k">'+esc(bits)+'</span>':'')+(sh.desc?'<span class="d">'+esc(sh.desc)+'</span>':'')+'</div>';
  }
  function status(t,err){ var s=$('#add-status'); s.textContent=t||''; s.classList.toggle('err',!!err); }
  var lookTimer=null;
  function onUrlChange(now){
    clearTimeout(lookTimer);
    var raw=$('#add-url').value.trim(), url=withScheme(raw);
    if(!sh.typeTouched){ sh.type=url?typeOf(url):'Note'; renderSheetTypes(); }
    if(!url||!validUrl(url)){ status(raw&&!validUrl(url)?'That doesn\'t look like a link yet':''); return; }
    if(url===sh.looked) return;
    var dup=!sh.editId&&library.find(function(i){ return i.url&&normUrl(i.url)===normUrl(url); });
    lookTimer=setTimeout(function(){
      sh.looked=url; var seq=sh.seq=(sh.seq||0)+1;
      status('Getting details…'); $('#add-form').classList.add('loading');
      lookup(url).then(function(d){
        if(seq!==sh.seq) return;
        if(!sh.titleTouched&&d.title) $('#add-title').value=d.title;
        sh.desc=d.desc||''; sh.site=d.site||siteOf(url); sh.meta=d.meta||''; sh.extra=d.extra||''; sh.img=d.img||''; if(d.url) sh.canon=d.url;
        if(!sh.typeTouched&&d.type){ sh.type=d.type; renderSheetTypes(); }
        status((dup?'Already in Saved: saving will update it. ':'')+'Filled in from '+(d.src==='page'?sh.site:d.src)+'.');
      }).catch(function(){
        if(seq!==sh.seq) return;
        if(!sh.titleTouched&&!$('#add-title').value) $('#add-title').value=titleFromUrl(url);
        sh.desc=''; sh.site=siteOf(url); sh.meta=''; sh.extra=''; sh.img='';
        status((dup?'Already in Saved: saving will update it. ':'')+'Couldn\'t fetch details. Edit the title if you like.');
      }).then(function(){ if(seq!==sh.seq) return; $('#add-form').classList.remove('loading'); renderPreview(); suggest(); });
    },now?0:550);
  }
  function openSheet(o){
    o=o||{}; var e=o.edit;
    sh={tags:new Set(e?(e.tags||[]):[]),type:e?e.type:(o.url?typeOf(withScheme(o.url)):'Note'),editId:e?e.id:'',desc:e?e.desc||'':'',site:e?e.site||'':'',meta:e?e.meta||'':'',img:e?e.img||'':'',extra:'',
      tagsTouched:!!e,typeTouched:!!e,titleTouched:!!(e||o.title),looked:e?withScheme(e.url||''):''};
    $('#add-h').textContent=e?'Edit saved item':'Add to Saved';
    $('#add-save').textContent=e?'Save changes':'Save';
    $('#add-url').value=e?(e.url&&/^https?:/.test(e.url)?e.url:''):(o.url||'');
    $('#add-title').value=e?e.title||'':(o.title||'');
    $('#add-note').value=e?e.note||'':(o.note||'');
    $('#add-newtopic').value='';
    var answer=e&&e.type==='Answer';
    $('#add-url-row').hidden=answer||(e&&e.url&&!/^https?:/.test(e.url)); $('#add-type-row').hidden=answer;
    status(''); renderSheetTypes(); renderPreview();
    sh.suggested=tagsFor(sheetText()); if(!e) sh.tags=new Set(sh.suggested); renderSheetTopics();
    sheet.hidden=false; document.body.classList.add('sheet-open');
    requestAnimationFrame(function(){ sheet.classList.add('on'); });
    if(!e&&o.url) onUrlChange(true);
    setTimeout(function(){ (e||o.url?$('#add-title'):$('#add-url')).focus({preventScroll:true}); },reduce?0:120);
  }
  function closeSheet(){ sh.seq=-1; clearTimeout(lookTimer); sheet.classList.remove('on'); document.body.classList.remove('sheet-open'); setTimeout(function(){ sheet.hidden=true; },reduce?0:220); }
  $('#add-url').addEventListener('input',function(){ onUrlChange(false); });
  $('#add-url').addEventListener('paste',function(){ setTimeout(function(){ onUrlChange(true); },0); });
  $('#add-url').addEventListener('blur',function(){ var v=$('#add-url').value.trim(); if(v&&withScheme(v)!==v&&validUrl(withScheme(v))) $('#add-url').value=withScheme(v); onUrlChange(true); });
  $('#add-title').addEventListener('input',function(){ sh.titleTouched=!!this.value; if(!sh.tagsTouched) suggest(); });
  $('#add-note').addEventListener('input',function(){ if(!sh.tagsTouched) suggest(); });
  $('#add-types').addEventListener('click',function(e){ var b=e.target.closest('[data-atype]'); if(!b) return; sh.type=b.dataset.atype; sh.typeTouched=true; renderSheetTypes(); });
  $('#add-topics').addEventListener('click',function(e){ var b=e.target.closest('[data-topic]'); if(!b) return; var t=b.dataset.topic; sh.tags.has(t)?sh.tags.delete(t):sh.tags.add(t); sh.tagsTouched=true; renderSheetTopics(); });
  function addTopicFromInput(){ var v=$('#add-newtopic').value; var t=addCustomTopic(v); if(!t) return; sh.tags.add(t); sh.tagsTouched=true; $('#add-newtopic').value=''; renderSheetTopics(); }
  $('#add-newtopic').addEventListener('keydown',function(e){ if(e.key==='Enter'){ e.preventDefault(); addTopicFromInput(); } });
  $('#add-topic-btn').addEventListener('click',addTopicFromInput);
  sheet.addEventListener('click',function(e){ if(e.target.closest('[data-close]')) closeSheet(); });
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&!sheet.hidden) closeSheet(); });
  $('#add-form').addEventListener('submit',function(e){
    e.preventDefault();
    if($('#add-newtopic').value.trim()) addTopicFromInput();
    var raw=$('#add-url').value.trim(), url=withScheme(raw), title=$('#add-title').value.trim(), note=$('#add-note').value.trim();
    var editing=sh.editId&&byId(sh.editId);
    if(raw&&!validUrl(url)){ status('Check the link: it should look like https://example.com/page',true); $('#add-url').focus(); return; }
    if(!url&&!title&&!note&&!editing){ status('Add a link or write a note first.',true); $('#add-url').focus(); return; }
    if(sh.canon&&normUrl(sh.canon)===normUrl(url)) url=sh.canon;
    var type=editing&&editing.type==='Answer'?'Answer':(url?(sh.type||typeOf(url)):(sh.typeTouched?sh.type:'Note'));
    if(!title) title=url?titleFromUrl(url):note.split('\n')[0].slice(0,70);
    var fields={type:type,title:title.slice(0,300),note:note.slice(0,4000),tags:Array.from(sh.tags).slice(0,8)};
    if(!(editing&&editing.type==='Answer')){ fields.url=url; fields.desc=sh.desc||''; fields.site=url?(sh.site||siteOf(url)):''; fields.meta=sh.meta||''; if(sh.img||!url) fields.img=sh.img||''; }
    var msg;
    var dupIdx=url?library.findIndex(function(i){ return i.url&&normUrl(i.url)===normUrl(url)&&i.id!==sh.editId; }):-1;
    if(editing&&dupIdx>-1){ library.splice(dupIdx,1); }
    if(editing){ Object.assign(editing,fields,{updatedAt:new Date().toISOString()}); msg='Changes saved'; }
    else if(dupIdx>-1){ var old=library[dupIdx]; Object.assign(old,fields,{note:fields.note||old.note||'',desc:fields.desc||old.desc||'',img:fields.img||old.img||'',updatedAt:new Date().toISOString()});
      library.splice(dupIdx,1); library.unshift(old); msg='Already saved: updated it'; }
    else{ library.unshift(Object.assign({id:newId(),question:'',savedAt:new Date().toISOString()},fields)); msg='Saved'+(fields.tags.length?' · '+fields.tags.slice(0,2).join(', '):''); }
    saveLib(); syncSaveButtons(); closeSheet(); toast(msg);
    if(!$('#view-lib').hidden) renderLibrary();
  });
  $('#fab').addEventListener('click',function(){ openSheet({}); });

  // Android share sheet -> "AI Radar" (manifest share_target) opens the sheet with the link filled in
  (function(){
    var p=new URLSearchParams(location.search), url=p.get('url')||'', text=p.get('text')||'', title=p.get('title')||'';
    if(!url&&!text&&!title) return;
    if(!url){ var m=text.match(/https?:\/\/\S+/); if(m){ url=m[0].replace(/[).,]+$/,''); text=text.replace(m[0],'').trim(); } }
    if(text===title) text='';
    try{ history.replaceState(null,'',location.pathname+location.hash); }catch(e){}
    switchTab('lib');
    openSheet({url:url,title:title&&title!==url?title:'',note:text});
  })();

  /* ---------------- UI: posts archive (every @ai_radar_ post) ---------------- */
  var postsP=null, POSTS=[];
  function absUrl(u){ return !u?'':/^https?:/.test(u)?u:ROOT+u.replace(/^\//,''); }
  function loadPosts(){
    if(postsP) return postsP;
    postsP=fetch(ROOT+'data/posts.json',{cache:'no-cache'}).then(function(r){ return r.ok?r.json():[]; }).catch(function(){ return []; }).then(function(list){
      POSTS=(list||[]).map(function(p){
        p.points=p.points||[];
        p.tags=(p.tags&&p.tags.length)?p.tags:tagsFor([p.title,p.summary,p.points.join(' ')].join(' '));
        p.text=[p.title,p.summary,p.points.join(' '),p.type,p.tags.join(' '),p.source].join(' ').toLowerCase();
        return p;
      }).sort(function(a,b){ return (b.date||'')<(a.date||'')?-1:1; });
      return POSTS;
    });
    return postsP;
  }
  function postKey(p){ return p.x_url||absUrl(p.link)||p.source||('post:'+p.id); }
  function postType(p){ return p.type==='News'||p.type==='Fact'?'Post':p.type; }
  function postAsCard(p){ return {type:p.type,title:p.title,desc:p.summary,url:postKey(p),site:'@ai_radar_',meta:'Posted '+fmtDate(p.date),img:p.img?absUrl(p.img):'',tags:p.tags}; }
  function postAsResource(p){ return {type:p.type==='Fact'?'AI fact':'Post',title:p.title,desc:p.summary,img:p.img?absUrl(p.img):'',url:postKey(p),site:'@ai_radar_',text:p.text,meta:'Posted '+fmtDate(p.date)}; }
  var POST_Q=/\b(your|our|ai radar'?s?|@?ai_radar_?'?s?)\s+posts?\b|\bposted\b|\bposts?\s+(about|on|from|we|you|i)\b|\b(old|older|previous|earlier|past|last)\s+posts?\b|\bpost\s+(we|you|i)\s+(did|made|shared|wrote)\b|\b(we|you|i)\s+(did|made|shared|wrote)\s+(a\s+)?post\b/i;
  function postSearch(q){
    var s=q.toLowerCase(), w=dateWindow(q);
    var type=/\bnews\b/.test(s)?'News':/\bfacts?\b/.test(s)?'Fact':/\brepos?\b|repositor/.test(s)?'Repo':/cheat ?sheets?/.test(s)?'Cheatsheet':/prompt ?packs?/.test(s)?'Prompt pack':'';
    var kw=terms(q).filter(function(t){ return MONTHS.indexOf(t)<0&&!/^(posts?|posted|news|facts?|cheatsheets?|packs?|show|find|yesterday|our|your|radar|ai_radar_|shared|wrote|made|did)$/.test(t); });
    var found=POSTS.filter(function(p){
      if(type&&p.type!==type) return false;
      var t=new Date(p.date).getTime();
      if(w.from&&t<w.from.getTime()) return false;
      if(w.to&&t>=w.to.getTime()) return false;
      return kw.every(function(k){ return hit(p.text,k); });
    });
    return {items:found.slice(0,10),total:found.length,window:w,kw:kw};
  }
  var pType='All', pDate='all', pTags=new Set(), pq='', pShown=20;
  var PTYPES=['All','News','Fact','Repo','Cheatsheet','Prompt pack'];
  function renderPosts(){
    $('#p-type').innerHTML=PTYPES.map(function(x){ return '<button class="f'+(pType===x?' on':'')+'" type="button" data-ptype="'+x+'" aria-pressed="'+(pType===x)+'">'+(x==='Fact'?'AI facts':x)+'</button>'; }).join('');
    $('#p-date').innerHTML=DATES.map(function(d){ return '<button class="f'+(pDate===d[0]?' on':'')+'" type="button" data-pdate="'+d[0]+'" aria-pressed="'+(pDate===d[0])+'">'+d[1]+'</button>'; }).join('');
    $('#p-custom').hidden=pDate!=='custom';
    var tags={}; POSTS.forEach(function(p){ p.tags.forEach(function(t){ tags[t]=(tags[t]||0)+1; }); });
    $('#p-tag').innerHTML=Object.keys(tags).sort(function(a,b){ return tags[b]-tags[a]; }).map(function(t){ var on=pTags.has(t); return '<button class="f tag'+(on?' on':'')+'" type="button" data-ptag="'+esc(t)+'" aria-pressed="'+on+'">#'+esc(t)+' <span style="opacity:.6">'+tags[t]+'</span></button>'; }).join('');
    var words=terms(pq);
    var list=POSTS.filter(function(p){
      if(pType!=='All'&&p.type!==pType) return false;
      if(!inRange(p.date,pDate,'#pd-from','#pd-to')) return false;
      if(pTags.size&&!p.tags.some(function(t){ return pTags.has(t); })) return false;
      if(words.length&&!words.every(function(w){ return hit(p.text,w); })) return false;
      return true;
    });
    $('#posts-count').textContent=POSTS.length?(list.length===POSTS.length?POSTS.length+' posts':list.length+' of '+POSTS.length):'';
    if(!POSTS.length){ $('#posts').innerHTML='<div class="empty"><b>No posts yet</b>New posts from @ai_radar_ appear here automatically.</div>'; $('#posts-more').hidden=true; return; }
    if(!list.length){ $('#posts').innerHTML='<div class="empty"><b>No matches</b>Try another filter or clear the search.</div>'; $('#posts-more').hidden=true; return; }
    $('#posts').innerHTML=list.slice(0,pShown).map(function(p){
      var key=postKey(p), saved=isSaved(key), open=p.x_url||absUrl(p.link)||p.source;
      var card={type:postType(p),title:p.title,desc:p.summary||'',url:key,site:'@ai_radar_',meta:'Posted '+fmtDate(p.date),question:'',img:p.img?absUrl(p.img):'',tags:p.tags};
      return '<article class="post">'+
        (p.img?'<a class="media" href="'+esc(open)+'" target="_blank" rel="noopener"><img src="'+esc(absUrl(p.img))+'" alt="" loading="lazy"></a>':'')+
        '<div class="pb"><div class="row1"><span class="type t-'+esc(p.type.split(' ')[0])+'">'+esc(p.type==='Fact'?'AI fact':p.type)+'</span><span class="when">'+esc(fmtDate(p.date))+'</span></div>'+
        '<h3>'+esc(p.title)+'</h3>'+(p.summary?'<p>'+esc(p.summary)+'</p>':'')+
        (p.points.length?'<ul>'+p.points.slice(0,4).map(function(x){ return '<li>'+esc(x)+'</li>'; }).join('')+'</ul>':'')+
        (p.tags.length?'<div class="tags">'+p.tags.map(function(t){ return '<span>#'+esc(t)+'</span>'; }).join('')+'</div>':'')+
        '<div class="acts">'+(p.x_url?'<a class="mini-btn" href="'+esc(p.x_url)+'" target="_blank" rel="noopener">View on X</a>':'')+
        (p.link?'<a class="mini-btn" href="'+esc(absUrl(p.link))+'" target="_blank" rel="noopener">Open card</a>':'')+
        (p.source&&p.source!==p.x_url?'<a class="mini-btn" href="'+esc(p.source)+'" target="_blank" rel="noopener">Source</a>':'')+
        '<button class="save'+(saved?' on':'')+'" type="button" aria-pressed="'+saved+'" aria-label="'+(saved?'Saved ':'Save ')+esc(p.title)+'" data-card="'+esc(JSON.stringify(card))+'">'+BM+'</button></div></div></article>';
    }).join('');
    $('#posts-more').hidden=list.length<=pShown;
  }
  $('#view-posts').addEventListener('click',function(e){
    var b;
    if((b=e.target.closest('.save'))){ toggleSave(b); }
    else if((b=e.target.closest('[data-ptype]'))){ pType=b.dataset.ptype; pShown=20; renderPosts(); }
    else if((b=e.target.closest('[data-pdate]'))){ pDate=b.dataset.pdate; pShown=20; renderPosts(); }
    else if((b=e.target.closest('[data-ptag]'))){ var t=b.dataset.ptag; pTags.has(t)?pTags.delete(t):pTags.add(t); pShown=20; renderPosts(); }
    else if(e.target.closest('#posts-more')){ pShown+=20; renderPosts(); }
  });
  $('#posts-q').addEventListener('input',function(e){ pq=e.target.value; pShown=20; renderPosts(); });
  $('#pd-from').addEventListener('change',renderPosts); $('#pd-to').addEventListener('change',renderPosts);


  /* ---------------- UI: Explore (every AI Radar resource + glossary) ---------------- */
  // Tags come from TOPICS (same as Saved); tasks and level are worked out here from each item's text.
  var TASKS=[
    {id:'build-agents',label:'Build an AI agent',hint:'Tools, memory and MCP',tags:['Agents','MCP'],rx:/agent memory/i},
    {id:'run-local',label:'Run AI on my computer',hint:'Private, offline models',tags:['Local LLMs']},
    {id:'prompts',label:'Write better prompts',hint:'Copy-ready prompts',tags:['Prompts']},
    {id:'own-data',label:'Use AI on my own data',hint:'RAG and fine-tuning',tags:['RAG','Fine-tuning','Datasets']},
    {id:'code',label:'Code faster with AI',hint:'Coding agents and reviews',tags:['Coding']},
    {id:'voice',label:'Work with voice and audio',hint:'Speech and transcription',tags:['Audio & Voice']},
    {id:'visuals',label:'Make images, video and 3D',hint:'Generation and editing',tags:['Image','Video'],rx:/\b3d\b|\bcad\b/i},
    {id:'secure',label:'Keep an AI app safe',hint:'Injection and guardrails',tags:['Security']},
    {id:'everyday',label:'Get everyday work done',hint:'Notes and summaries',tags:['Spreadsheets'],rx:/\bnotes?\b|summar|action items|meeting|email/i},
    {id:'learn',label:'Learn the basics',hint:'Plain-English guides',tags:['Learning'],rx:/token|pricing|jargon|cheatsheet/i}
  ];
  var LEVELS=['Beginner','Intermediate','Advanced'];
  function levelOf(it){
    var t=it.text;
    if(it.type==='Prompt pack'||/basics|beginner|plain english|\b101\b|jargon|explained|one-page|getting started/.test(t)) return 'Beginner';
    if(it.type==='Cheatsheet') return /agent|rag|fine[- ]?tun|injection|securit/.test(t)?'Intermediate':'Beginner';
    if(/mcp server|framework|plugin|fine[- ]?tun|\bsdk\b|kernel|compiler|inference engine|quantiz|cuda|context window/.test(t)) return 'Advanced';
    return 'Intermediate';
  }
  function enrich(it){
    if(it._x) return it;
    it.tags=tagsFor(it.text); it.level=levelOf(it); it.pricing='Free';
    it.tasks=TASKS.filter(function(k){ return k.tags.some(function(g){ return it.tags.indexOf(g)>-1; })||(k.rx&&k.rx.test(it.text)); }).map(function(k){ return k.id; });
    it._x=1; return it;
  }
  var ex={mode:'res',q:'',task:'',type:'',level:'',tags:new Set(),free:false,sort:'new'}, exItems=[], gloss=null, glossP=null;
  function loadGlossary(){ if(glossP) return glossP; glossP=fetch('glossary.json',{cache:'no-cache'}).then(function(r){ return r.json(); }).then(function(d){ gloss=d.sort(function(a,b){ return a.term.localeCompare(b.term); }); return gloss; }).catch(function(){ glossP=null; gloss=[]; return gloss; }); return glossP; }
  function loadExplore(){
    return Promise.all([loadIndex(),loadPosts().catch(function(){ return []; })]).then(function(){
      exItems=(window.__airIndex||[]); return exItems;
    });
  }
  function exPass(i,skip,words){
    if(skip!=='task'&&ex.task&&i.tasks.indexOf(ex.task)<0) return false;
    if(skip!=='type'&&ex.type&&i.type!==ex.type) return false;
    if(skip!=='level'&&ex.level&&i.level!==ex.level) return false;
    if(skip!=='tag'&&ex.tags.size){ var ok=true; ex.tags.forEach(function(t){ if(i.tags.indexOf(t)<0) ok=false; }); if(!ok) return false; }
    if(skip!=='free'&&ex.free&&i.pricing!=='Free') return false;
    if(words&&words.length&&!words.every(function(w){ return hit(i.text,w); })) return false;
    return true;
  }
  function exDate(i){
    if(i.date) return i.date;
    var p=(POSTS||[]).find(function(x){ return x.link===i.link; });
    return i.date=(p&&p.date)||'';
  }
  function renderExplore(){
    var isRes=ex.mode==='res';
    $('#ex-mode').innerHTML=chip('data-exmode','res','Resources',isRes)+chip('data-exmode','gloss','Glossary',!isRes);
    $('#ex-q').placeholder=isRes?'Search repos, cheatsheets, prompt packs':'Search AI terms';
    $('#ex-res').hidden=!isRes; $('#ex-gloss').hidden=isRes;
    if(isRes) renderResources(); else renderGlossary();
  }
  function renderResources(){
    var words=terms(ex.q), all=exItems.map(enrich);
    var cnt=function(skip,fn){ return all.filter(function(i){ return exPass(i,skip,words)&&fn(i); }).length; };
    $('#ex-tasks').innerHTML=TASKS.map(function(k){
      var n=cnt('task',function(i){ return i.tasks.indexOf(k.id)>-1; }); if(!n&&ex.task!==k.id) return '';
      return '<button class="task'+(ex.task===k.id?' on':'')+'" type="button" data-task="'+k.id+'" aria-pressed="'+(ex.task===k.id)+'"><b>'+esc(k.label)+'</b><span>'+esc(k.hint)+'</span><span class="n">'+n+'</span></button>';
    }).join('');
    var types=['Repo','Cheatsheet','Prompt pack'];
    $('#ex-type').innerHTML=chip('data-extype','','All',!ex.type,cnt('type',function(){ return true; }))+types.map(function(t){ return chip('data-extype',t,t==='Prompt pack'?'Prompt packs':t+'s',ex.type===t,cnt('type',function(i){ return i.type===t; })); }).join('')+
      chip('data-exfree','1','Free only',ex.free,null,'free');
    $('#ex-level').innerHTML=chip('data-exlevel','','Any level',!ex.level)+LEVELS.map(function(l){ return chip('data-exlevel',l,l,ex.level===l,cnt('level',function(i){ return i.level===l; }),'lv lv-'+l); }).join('');
    var tg={}; all.filter(function(i){ return exPass(i,'tag',words); }).forEach(function(i){ i.tags.forEach(function(t){ tg[t]=(tg[t]||0)+1; }); });
    ex.tags.forEach(function(t){ if(!tg[t]) tg[t]=0; });
    var keys=Object.keys(tg).sort(function(a,b){ return (ex.tags.has(b)-ex.tags.has(a))||tg[b]-tg[a]||a.localeCompare(b); });
    $('#ex-tag').innerHTML=keys.map(function(t){ return chip('data-extag',t,'#'+esc(t),ex.tags.has(t),tg[t],'tag'); }).join(''); $('#ex-tag').hidden=!keys.length;
    var list=all.filter(function(i){ return exPass(i,null,words); });
    var order={Beginner:0,Intermediate:1,Advanced:2};
    list.sort(ex.sort==='az'?function(a,b){ return a.title.localeCompare(b.title); }:ex.sort==='easy'?function(a,b){ return order[a.level]-order[b.level]||exDate(b).localeCompare(exDate(a)); }:function(a,b){ return exDate(b).localeCompare(exDate(a)); });
    var any=ex.task||ex.type||ex.level||ex.tags.size||ex.free||words.length;
    $('#ex-count').textContent=list.length+(list.length===1?' resource':' resources')+(all.every(function(i){ return i.pricing==='Free'; })&&!ex.free?' · all free':'');
    $('#ex-clear').hidden=!any;
    if(!exItems.length){ $('#ex-items').innerHTML='<div class="empty"><b>Loading…</b></div>'; return; }
    if(!list.length){ $('#ex-items').innerHTML='<div class="empty"><b>Nothing matches</b>Try fewer filters, or ask the chat: it also searches GitHub and the web.<button class="pill-btn mint" type="button" data-exask="'+esc(ex.q||'What should I learn first about AI?')+'" style="margin-top:10px">Ask “'+esc(ex.q||'what should I learn first?')+'”</button></div>'; return; }
    $('#ex-items').innerHTML=list.map(function(i,n){
      var saved=isSaved(i.url), card={type:i.type,title:i.title,desc:i.desc||'',url:i.url,site:'AI Radar',meta:i.meta||'',img:i.img||'',tags:i.tags};
      var badges='<span class="lv lv-'+i.level+'">'+i.level+'</span><span class="free">'+esc(i.pricing)+'</span>'+(i.stars?'<span>★ '+esc(i.stars)+'</span>':'')+(i.count?'<span>'+i.count+' prompts</span>':'')+i.tags.slice(0,3).map(function(t){ return '<span>'+esc(t)+'</span>'; }).join('');
      return '<article class="item ex" style="animation-delay:'+Math.min(n,8)*35+'ms" data-k="'+n+'">'+
        (i.img?'<a class="ex-thumb" href="'+esc(i.url)+'" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true"><img src="'+esc(i.img)+'" alt="" loading="lazy"></a>':'')+
        '<div class="ex-body"><div class="t"><b>'+esc(i.title)+'</b><span class="type">'+esc(i.type==='Cheatsheet'&&i.cat?i.cat:i.type)+'</span></div>'+
        (i.desc?'<div class="q">'+esc(i.desc)+'</div>':'')+'<div class="badges">'+badges+'</div>'+
        '<div class="acts"><a class="mini-btn" href="'+esc(i.url)+'" target="_blank" rel="noopener">Open</a>'+(i.ext?'<a class="mini-btn" href="'+esc(i.ext)+'" target="_blank" rel="noopener">GitHub</a>':'')+
        '<button class="mini-btn exask" type="button">Ask about this</button>'+
        '<button class="save'+(saved?' on':'')+'" type="button" aria-pressed="'+saved+'" aria-label="'+(saved?'Saved':'Save')+' '+esc(i.title)+'" data-card="'+esc(JSON.stringify(card))+'">'+BM+'</button></div></div></article>';
    }).join('');
    exShown=list;
  }
  var exShown=[];
  function renderGlossary(){
    if(!gloss){ $('#ex-gloss-list').innerHTML='<div class="empty"><b>Loading…</b></div>'; loadGlossary().then(function(){ if(ex.mode==='gloss') renderGlossary(); }); return; }
    var words=terms(ex.q), tagsWithItems={};
    exItems.forEach(function(i){ enrich(i).tags.forEach(function(t){ tagsWithItems[t]=1; }); });
    var list=gloss.filter(function(g){ var h=(g.term+' '+g.def).toLowerCase(); return !words.length||words.every(function(w){ return hit(h,w); }); });
    if(words.length){ var qq=ex.q.trim().toLowerCase(); var rank=function(g){ var t=g.term.toLowerCase(); return t===qq?0:t.indexOf(qq)===0?1:t.indexOf(qq)>-1?2:3; }; list=list.slice().sort(function(a,b){ return rank(a)-rank(b)||a.term.localeCompare(b.term); }); }
    $('#ex-count').textContent=list.length+(list.length===1?' term':' terms'); $('#ex-clear').hidden=!ex.q;
    if(!list.length){ $('#ex-gloss-list').innerHTML='<div class="empty"><b>No term matches</b><button class="pill-btn mint" type="button" data-exask="What is '+esc(ex.q)+' in AI? Explain simply." style="margin-top:10px">Ask what “'+esc(ex.q)+'” means</button></div>'; return; }
    var last='';
    $('#ex-gloss-list').innerHTML=list.map(function(g){
      var L=g.term[0].toUpperCase(), head=L!==last&&!words.length?'<div class="g-letter">'+L+'</div>':''; last=L;
      return head+'<article class="item g"><div class="t"><b>'+esc(g.term)+'</b>'+(g.tag?'<span class="type">'+esc(g.tag)+'</span>':'')+'</div><div class="g-def">'+esc(g.def)+'</div>'+
        '<div class="acts"><button class="mini-btn" type="button" data-exask="What is '+esc(g.term)+' in AI? Explain simply with an example.">Ask about this</button>'+
        (g.tag&&tagsWithItems[g.tag]?'<button class="mini-btn" type="button" data-gtag="'+esc(g.tag)+'">'+esc(g.tag)+' resources</button>':'')+
        '<button class="save'+(isSaved(ROOT+'app-beta/#glossary-'+g.term.toLowerCase().replace(/[^a-z0-9]+/g,'-'))?' on':'')+'" type="button" aria-label="Save '+esc(g.term)+'" data-card="'+esc(JSON.stringify({type:'Note',title:g.term,desc:g.def,url:ROOT+'app-beta/#glossary-'+g.term.toLowerCase().replace(/[^a-z0-9]+/g,'-'),site:'AI Radar glossary',tags:g.tag?[g.tag]:[]}))+'">'+BM+'</button></div></article>';
    }).join('');
  }
  $('#view-explore').addEventListener('click',function(e){
    var b;
    if((b=e.target.closest('.save'))){ toggleSave(b); }
    else if((b=e.target.closest('[data-exmode]'))){ ex.mode=b.dataset.exmode; renderExplore(); $('#view-explore').scrollTo({top:0}); }
    else if((b=e.target.closest('[data-task]'))){ ex.task=ex.task===b.dataset.task?'':b.dataset.task; renderResources(); }
    else if((b=e.target.closest('[data-extype]'))){ ex.type=b.dataset.extype; renderResources(); }
    else if((b=e.target.closest('[data-exfree]'))){ ex.free=!ex.free; renderResources(); }
    else if((b=e.target.closest('[data-exlevel]'))){ ex.level=b.dataset.exlevel; renderResources(); }
    else if((b=e.target.closest('[data-extag]'))){ var t=b.dataset.extag; ex.tags.has(t)?ex.tags.delete(t):ex.tags.add(t); renderResources(); }
    else if((b=e.target.closest('[data-gtag]'))){ ex.mode='res'; ex.q=''; $('#ex-q').value=''; ex.task=''; ex.type=''; ex.level=''; ex.tags=new Set([b.dataset.gtag]); renderExplore(); $('#view-explore').scrollTo({top:0,behavior:reduce?'auto':'smooth'}); }
    else if((b=e.target.closest('[data-exask]'))){ switchTab('chat'); ask(b.dataset.exask); }
    else if((b=e.target.closest('.exask'))){ var it=exShown[+b.closest('.item').dataset.k]; if(it) askAbout({type:it.type,title:it.title,desc:it.desc}); }
    else if(e.target.closest('#ex-clear')){ ex.q=''; $('#ex-q').value=''; ex.task=''; ex.type=''; ex.level=''; ex.tags.clear(); ex.free=false; renderExplore(); }
  });
  var exT; $('#ex-q').addEventListener('input',function(e){ clearTimeout(exT); exT=setTimeout(function(){ ex.q=e.target.value; renderExplore(); },120); });
  $('#ex-sort').addEventListener('change',function(e){ ex.sort=e.target.value; renderResources(); });

  /* ---------------- tabs, badge, toast ---------------- */
  function switchTab(name){
    document.querySelectorAll('.tab').forEach(function(t){ var on=t.dataset.tab===name; t.classList.toggle('on',on); if(on) t.setAttribute('aria-current','page'); else t.removeAttribute('aria-current'); });
    $('#view-chat').hidden=name!=='chat'; $('#view-lib').hidden=name!=='lib'; $('#view-posts').hidden=name!=='posts'; $('#view-explore').hidden=name!=='explore'; $('#composer-host').hidden=name!=='chat'; document.body.dataset.tab=name;
    if(name==='lib') renderLibrary(); else if(name==='posts'){ loadPosts().then(renderPosts); } else if(name==='explore'){ renderExplore(); loadExplore().then(function(){ if(!$('#view-explore').hidden) renderExplore(); }); } else scrollDown();
    try{ history.replaceState(null,'',name==='lib'?'#saved':name==='posts'?'#posts':name==='explore'?'#explore':'#'); }catch(e){}
    if(window.__pillTo) window.__pillTo(name);
  }
  document.querySelectorAll('.tab').forEach(function(t){ t.addEventListener('click',function(){ switchTab(t.dataset.tab); }); });

  /* ---------------- tab bar: sliding glass lens ---------------- */
  (function(){
    var bar=$('#tabbar'), pill=$('#tab-pill'), glow=$('#tab-glow'), tabs=[].slice.call(document.querySelectorAll('.tab'));
    if(!bar||!pill||!tabs.length) return;
    document.body.classList.add('has-pill');
    var x=0, v=0, target=0, w=0, raf=0, last=0, drag=null, lean=0, suppress=false;
    var K=520, D=34;                         // spring stiffness / damping: quick with a small overshoot
    function geo(i){ var t=tabs[i]; var inset=Math.min(14,t.offsetWidth*.1); return {l:t.offsetLeft+inset,w:t.offsetWidth-inset*2,c:t.offsetLeft+t.offsetWidth/2}; }
    function activeIndex(){ var i=tabs.findIndex(function(t){ return t.classList.contains('on'); }); return i<0?0:i; }
    function nearest(cx){ var best=0,bd=1e9; tabs.forEach(function(t,i){ var d=Math.abs(geo(i).c-cx); if(d<bd){ bd=d; best=i; } }); return best; }
    function paint(){
      var sx=1+Math.min(.28,Math.abs(v)/2600), sy=1-Math.min(.14,Math.abs(v)/5200);
      if(drag){ sx*=1.06; sy*=1.06; }
      pill.style.width=w+'px';
      pill.style.transform='translate3d('+(x-w/2)+'px,0,0) scale('+sx.toFixed(3)+','+sy.toFixed(3)+')';
      if(glow){ glow.style.width=w+'px'; glow.style.transform='translate3d('+(x-w/2)+'px,0,0) scaleX('+sx.toFixed(3)+')'; }
      // lens magnifies the icon underneath it
      tabs.forEach(function(t,i){ var g=geo(i), d=Math.abs(g.c-x)/(t.offsetWidth||1), k=Math.max(0,1-d*1.6);
        var ic=t.querySelector('svg'); if(ic) ic.style.transform=k>0.01?'scale('+(1+.16*k).toFixed(3)+') translateY('+(-1.5*k).toFixed(2)+'px)':''; });
    }
    function step(ts){
      var dt=Math.min(.032,(ts-(last||ts))/1000||.016); last=ts;
      if(drag){ v=(drag.x-x)/Math.max(dt,.008); x=drag.x; }
      else{ var a=-K*(x-(target+lean))-D*v; v+=a*dt; x+=v*dt; }
      paint();
      if(drag||Math.abs(x-(target+lean))>.3||Math.abs(v)>4){ raf=requestAnimationFrame(step); }
      else{ x=target+lean; v=0; paint(); raf=0; last=0; }
    }
    function kick(){ if(reduce){ x=drag?drag.x:target+lean; v=0; paint(); return; } if(!raf){ last=0; raf=requestAnimationFrame(step); } }
    function settle(i,instant){ var g=geo(i); if(!tabs[i].offsetWidth) return; target=g.c; w=g.w; if(!pill.classList.contains('ready')){ pill.classList.add('ready'); if(glow) glow.classList.add('ready'); instant=true; } if(instant){ x=target; v=0; paint(); } else kick(); }
    window.__pillTo=function(name){ var i=tabs.findIndex(function(t){ return t.dataset.tab===name; }); if(i>-1){ lean=0; settle(i,document.hidden); } };
    document.addEventListener('visibilitychange',function(){ if(!document.hidden){ cancelAnimationFrame(raf); raf=0; drag=null; lean=0; settle(activeIndex(),true); } });
    function local(e){ var r=bar.getBoundingClientRect(); return e.clientX-r.left; }
    // drag the lens across the tabs; release picks the tab under it
    bar.addEventListener('pointerdown',function(e){
      if(e.button>0||!e.target.closest('.tab')) return;
      drag={x0:local(e),x:x,moved:false,id:e.pointerId};
    });
    bar.addEventListener('pointermove',function(e){
      if(drag&&e.pointerId===drag.id){
        var px=local(e);
        if(!drag.moved&&Math.abs(px-drag.x0)>6){ drag.moved=true; pill.classList.add('lift'); try{ bar.setPointerCapture(e.pointerId); }catch(_){} }
        if(drag.moved){ var lo=geo(0).c-10, hi=geo(tabs.length-1).c+10; drag.x=Math.max(lo,Math.min(hi,px)); kick(); }
        return;
      }
      if(e.pointerType!=='mouse') return;
      var t=e.target.closest('.tab'); tabs.forEach(function(x){ x.classList.toggle('hover',x===t); });
      // hover: the lens leans a little toward the tab under the mouse
      var nl=t?Math.max(-14,Math.min(14,(geo(tabs.indexOf(t)).c-target)*.12)):0;
      if(nl!==lean){ lean=nl; kick(); }
    });
    function end(e){
      if(!drag||(e&&e.pointerId!==drag.id)) return;
      var moved=drag.moved, px=drag.x; drag=null; pill.classList.remove('lift');
      if(moved){ suppress=true; setTimeout(function(){ suppress=false; },60); var i=nearest(px); switchTab(tabs[i].dataset.tab); }
      kick();
    }
    bar.addEventListener('pointerup',end); bar.addEventListener('pointercancel',end);
    bar.addEventListener('pointerleave',function(e){ if(e.pointerType==='mouse'&&!drag){ tabs.forEach(function(x){ x.classList.remove('hover'); }); if(lean){ lean=0; kick(); } } });
    bar.addEventListener('click',function(e){ if(suppress){ e.stopPropagation(); e.preventDefault(); } },true);
    // press feedback: the lens lifts while a tab is held
    bar.addEventListener('pointerdown',function(e){ if(e.target.closest('.tab')){ pill.classList.add('lift'); setTimeout(function(){ if(!drag||!drag.moved) pill.classList.remove('lift'); },180); } });
    function init(){ settle(activeIndex(),true); }
    // the glass library re-mounts the bar after load, so watch the tabs themselves for their real size
    if('ResizeObserver' in window){ var ro=new ResizeObserver(function(){ settle(activeIndex(),true); }); tabs.forEach(function(t){ ro.observe(t); }); }
    window.addEventListener('resize',function(){ settle(activeIndex(),true); });
    requestAnimationFrame(init);
    document.addEventListener('airadar-glass-ready',function(){ setTimeout(init,60); });
  })();
  function updateBadge(){ var b=$('#badge'); b.hidden=!library.length; b.textContent=library.length>99?'99+':library.length; }
  var tt; function toast(m){ var el=$('#toast'); el.textContent=m; el.classList.add('on'); clearTimeout(tt); tt=setTimeout(function(){ el.classList.remove('on'); },1700); }
  updateBadge();
  if(/^#col=/.test(location.hash)) importSharedCollection(location.hash);
  else if(location.hash==='#library'||location.hash==='#saved') switchTab('lib'); else if(location.hash==='#posts') switchTab('posts'); else if(location.hash==='#explore'||/^#glossary/.test(location.hash)){ if(/^#glossary/.test(location.hash)) ex.mode='gloss'; switchTab('explore'); }
  loadPosts();

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

/* liquid glass on the floating bars (vendor/glass.js, built from app-src/ with @samasante/liquid-glass) */
(function(){
  function apply(){
    var G=window.AIRadarGlass; if(!G) return;
    // dark tint + no brightness veil so labels stay readable over bright cheatsheet cards
    var tint='rgba(10,12,11,0.66)', optics={frost:10,brightness:0,glow:0.06,dispersion:0.3};
    G.wrap(document.getElementById('topbar'),{display:'flex',tint:tint,optics:optics});
    G.wrap(document.getElementById('composer'),{display:'flex',tint:tint,optics:optics});
    G.wrap(document.getElementById('tabbar'),{display:'grid',tint:tint,optics:optics});
    G.wrap(document.getElementById('fab-glass'),{display:'grid',tint:'rgba(255,255,255,0.04)',optics:optics});
  }
  if(window.AIRadarGlass) apply(); else document.addEventListener('airadar-glass-ready',apply,{once:true});
})();
