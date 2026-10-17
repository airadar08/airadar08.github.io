// "Ask AI Radar" chat overlay. Talks to the Cloudflare Worker (worker/worker.js), which holds the API key.
// Stays hidden until ENDPOINT is set to the Worker's URL.
(function(){
  var ENDPOINT = "https://airadar-chat.asm-gamingyt.workers.dev";
  if(!ENDPOINT) return;

  var LOGO='<svg viewBox="0 0 400 400" aria-hidden="true"><circle cx="200" cy="200" r="194" fill="#13a36b" stroke="#0f8a5a" stroke-width="8"/><g transform="translate(189 195) scale(0.74) translate(-224 -166)"><text x="182" y="285" text-anchor="middle" font-family="Inter,Helvetica,Arial,sans-serif" font-weight="900" font-size="230" letter-spacing="-10" fill="#ffffff">a</text><rect x="268" y="160" width="40" height="125" rx="6" fill="#ffffff"/><circle cx="288" cy="112" r="24" fill="#1d1d1f"/><path d="M299.4 69.5 A44 44 0 0 1 330.5 100.6" stroke="#1d1d1f" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.85"/><path d="M305.1 48.2 A66 66 0 0 1 351.8 94.9" stroke="#1d1d1f" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.55"/></g></svg>';
  var LABS=[
    {g:"US labs",items:[["OpenAI","OpenAI (ChatGPT)"],["Google","Google (Gemini)"],["Anthropic","Anthropic (Claude)"],["Meta","Meta AI (Llama, Muse)"],["xAI","xAI (Grok)"],["Microsoft","Microsoft (Copilot)"],["NVIDIA","NVIDIA (Nemotron)"]]},
    {g:"Chinese labs",items:[["DeepSeek","DeepSeek"],["Qwen","Alibaba (Qwen)"],["Kimi","Moonshot AI (Kimi)"],["GLM","Zhipu AI (GLM)"],["MiniMax","MiniMax"],["Doubao","ByteDance (Doubao, Seed)"]]},
    {g:"Europe",items:[["Mistral","Mistral AI"]]}
  ];
  var SUGGEST=["What's new in AI this week?","Top 5 trending repos for audio right now","Explain RAG in simple words","AI tricks for Excel and Google Sheets"];
  var KEY='air-chat-v2';
  // Site root, worked out from this script's own URL so the chat works on every page.
  var BASE=(function(){ try{ return new URL('..',document.currentScript.src).href; }catch(e){ return location.origin+'/'; } })();

  /* ---------- 1. Our own resources (repos, cheatsheets, prompt packs) ---------- */
  var STOPW=new Set("a an the is are was were be been what whats which who how why when where do does did any some about from of for on in at to with and or but me my i you your tell give show find list get need want best top good great cool new newest latest recent popular trending hot right now today currently current this week month year ai please can could would should there their it its using use used help explain simple simply words word into like vs versus more most much many make makes made one two three four five six seven eight nine ten repo repos repository repositories github open source opensource project projects tool tools library libraries app apps something things thing".split(" "));
  var SYN={audio:["voice","speech","tts","sound","music","transcri","dubb","podcast"],voice:["audio","speech","tts","dubb"],speech:["voice","audio","tts","transcri"],music:["audio","sound"],
    image:["vision","photo","picture","diffusion","visual"],video:["film","animation","clip"],code:["coding","developer","programming"],coding:["code","developer"],
    agent:["agents","agentic","automation"],agents:["agent","agentic"],local:["offline","locally","self-host","on-device","private"],offline:["local","locally"],
    prompt:["prompts","prompting"],prompts:["prompt","prompting"],rag:["retrieval"],security:["injection","jailbreak","attack"],cad:["3d"],"3d":["cad"],
    llm:["model","models","language"],jargon:["terms","glossary"],excel:["spreadsheet","sheets"],spreadsheet:["excel","sheets"],presentation:["slides","ppt","deck"],slides:["presentation","ppt","deck"]};
  function terms(q){
    var words=q.toLowerCase().replace(/[^a-z0-9\s\-]/g,' ').split(/\s+/).filter(function(w){ return w.length>1 && !STOPW.has(w) && !/^\d+$/.test(w); });
    return words;
  }
  var indexP=null;
  function loadIndex(){
    if(indexP) return indexP;
    function get(u,t){ return fetch(BASE+u+(u.indexOf('?')<0?'?':'&')+'t='+Math.floor(Date.now()/6e5)).then(function(r){ return r.ok?(t==='text'?r.text():r.json()):(t==='text'?'':[]); }).catch(function(){ return t==='text'?'':[]; }); }
    indexP=Promise.all([get('data/repos.json'),get('data/packs.json'),get('cheatsheets/','text')]).then(function(res){
      var items=[];
      (res[0]||[]).forEach(function(r){ items.push({kind:'Repo',title:r.repo,desc:r.tagline||'',img:r.img?BASE+r.img:'',url:BASE+'repos/#'+r.slug,
        text:[r.repo,r.tagline,(r.what||[]).join(' '),r.read,r.language].join(' ').toLowerCase()}); });
      (res[1]||[]).forEach(function(k){ items.push({kind:'Prompt pack',title:k.title,desc:k.desc||'',img:k.cover?BASE+k.cover:'',url:BASE+k.url,
        text:[k.title,k.desc,k.keyword,'prompt prompts prompting pack'].join(' ').toLowerCase()}); });
      if(res[2]){ try{
        var doc=new DOMParser().parseFromString(res[2],'text/html');
        doc.querySelectorAll('article.sheet[id]').forEach(function(a){
          var b=a.querySelector('.meta b'), d=a.querySelector('.meta .desc'), k=a.querySelector('.meta .kind'), im=a.querySelector('img');
          var t=b?b.textContent.trim():a.id;
          items.push({kind:'Cheatsheet',title:t,desc:d?d.textContent.trim():'',img:im?BASE+'cheatsheets/'+im.getAttribute('src'):'',url:BASE+'cheatsheets/#'+a.id,
            text:[t,d&&d.textContent,k&&k.textContent,im&&im.alt,a.id.replace(/-/g,' '),'cheatsheet'].join(' ').toLowerCase()});
        });
      }catch(e){} }
      return items;
    });
    return indexP;
  }
  function has(text,w){ return w.length<=3 ? new RegExp('(^|[^a-z0-9])'+w.replace(/[^a-z0-9]/g,'')+'([^a-z0-9]|$)').test(text) : text.indexOf(w)>=0; }
  function matchSite(q,items){
    var base=ghTerms(q); if(!base.length) return [];   // same cleaning as repo search
    var groups=base.map(function(w){ return [w].concat(SYN[w]||[]); });
    var wantKind=/cheat ?sheets?/i.test(q)?'Cheatsheet':/prompt ?packs?|prompts?\b/i.test(q)?'Prompt pack':/\b(repos?|repositor(y|ies)|github)\b/i.test(q)?'Repo':'';
    return items.map(function(it){
      var score=0;
      groups.forEach(function(g){ if(g.some(function(w){ return w.length>=2 && has(it.text,w); })) score+=1; });
      if(score && wantKind && it.kind===wantKind) score+=0.5;
      return {it:it,score:score};
    }).filter(function(x){ return x.score>=1; }).sort(function(a,b){ return b.score-a.score; }).slice(0,3).map(function(x){ return x.it; });
  }

  /* ---------- 2. Live GitHub search for repo questions ---------- */
  var REPO_Q=/\b(repos?|repositor(y|ies)|github|open[- ]?source (projects?|tools?|models?|librar(y|ies)))\b/i;
  var NUMW={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10};
  var AIRX=/(\bai\b|llm|model|agent|neural|machine.learning|\bml\b|tts|asr|speech|voice|gpt|diffusion|generat|transformer|inference|whisper|\brag\b|vision|language|deep.learning|claude|openai|gemini|qwen|llama|mcp)/i;
  function daysAgo(n){ return new Date(Date.now()-n*864e5).toISOString().slice(0,10); }
  function ghSearch(q){
    return fetch('https://api.github.com/search/repositories?q='+encodeURIComponent(q)+'&sort=stars&order=desc&per_page=30',{headers:{'Accept':'application/vnd.github+json'}})
      .then(function(r){ if(!r.ok) throw new Error('github '+r.status); return r.json(); }).then(function(j){ return j.items||[]; });
  }
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
    function card(i){ return {name:i.full_name,url:i.html_url,desc:i.description||'',stars:i.stargazers_count,lang:i.language||'',created:(i.created_at||'').slice(0,10)}; }
    var ai=aiQ&&!/topic:ai-agents|topic:llm|topic:mcp|topic:rag/.test(quals)?' ai':'';
    var tries=wantNew
      ? [quals+ai+' created:>'+daysAgo(180), quals+ai+' pushed:>'+daysAgo(30)+' stars:>500', plain+ai+' stars:>100']
      : [quals+ai+' stars:>200 pushed:>'+daysAgo(120), quals+ai+' stars:>50', plain+ai+' stars:>50'];
    var picks=[], seen={};
    function run(k){
      if(k>=tries.length||picks.length>=n) return Promise.resolve();
      var qq=tries[k].trim(), viaTopic=/topic:/.test(qq);
      return ghSearch(qq).then(function(a){
        a.forEach(function(i){ if(picks.length<n&&!seen[i.id]&&ok(i)&&(viaTopic||onTopic(i,true))){ seen[i.id]=1; picks.push(i); } });
      }).catch(function(e){ if(!picks.length&&k===0) throw e; }).then(function(){ return run(k+1); });
    }
    return run(0).then(function(){
      // a few brand-new AI repos for a non-AI topic ("frontend" -> AI UI builders, design skills for coding agents)
      if(aiQ||!plain) return [];
      return ghSearch(plain+' ai created:>'+daysAgo(180)).then(function(a){
        return a.filter(function(i){ return !seen[i.id]&&!i.fork&&!i.archived&&AIRX.test(hay(i,true))&&onTopic(i,false); }).slice(0,3);
      }).catch(function(){ return []; });
    }).then(function(extra){
      return {n:n,topic:topic,aiQ:aiQ,since:daysAgo(180),fresh:wantNew,items:picks.map(card),extra:extra.map(card)};
    });
  }
  function kfmt(n){ return n>=1000?(n/1000).toFixed(n>=10000?0:1).replace(/\.0$/,'')+'k':String(n); }

  var css=`
.airc-fab{position:fixed;right:calc(20px + env(safe-area-inset-right,0px));bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:60;display:flex;align-items:center;gap:10px;
  background:var(--ink);color:var(--on-ink);border:0;border-radius:999px;padding:8px 18px 8px 8px;font:600 15px var(--body);cursor:pointer;
  box-shadow:0 12px 30px -12px rgba(0,0,0,.45);transition:transform .3s var(--ease),opacity .3s}
.airc-fab:hover{transform:translateY(-3px)}
.airc-fab svg{width:34px;height:34px}
.airc-fab .dot{width:8px;height:8px;border-radius:50%;background:var(--mint);box-shadow:0 0 0 0 var(--mint);animation:aircPulse 2.4s infinite}
@keyframes aircPulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--mint) 60%,transparent)}70%{box-shadow:0 0 0 10px transparent}100%{box-shadow:0 0 0 0 transparent}}
.airc-open .airc-fab{opacity:0;pointer-events:none;transform:scale(.9)}
.airc-panel{position:fixed;right:calc(20px + env(safe-area-inset-right,0px));bottom:calc(20px + env(safe-area-inset-bottom,0px));z-index:61;width:min(400px,calc(100vw - 40px));height:min(620px,calc(100vh - 110px));
  display:grid;grid-template-rows:auto 1fr auto;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:22px;overflow:hidden;
  box-shadow:0 30px 80px -30px rgba(0,0,0,.45);transform-origin:bottom right;opacity:0;transform:translateY(16px) scale(.97);pointer-events:none;transition:opacity .3s var(--ease),transform .35s var(--ease)}
.airc-open .airc-panel{opacity:1;transform:none;pointer-events:auto}
@media (max-width:560px){.airc-fab{padding:7px}.airc-fab span:not(.dot){display:none}.airc-fab .dot{position:absolute;top:6px;right:6px}}
@media (max-width:560px){.airc-panel{right:0;left:0;bottom:0;width:100%;height:min(88vh,calc(100% - 40px));border-radius:22px 22px 0 0;border-bottom:0;padding-bottom:env(safe-area-inset-bottom,0px)}}
.airc-head{display:flex;align-items:center;gap:12px;padding:14px 14px 14px 16px;border-bottom:1px solid var(--line);background:var(--surface)}
.airc-head > svg{width:36px;height:36px;flex:none}
.airc-head b{display:block;font:700 16px var(--display)}
.airc-head span{font-size:12.5px;color:var(--muted)}
.airc-head .x{all:unset;margin-left:auto;cursor:pointer;width:34px;height:34px;display:grid;place-items:center;border-radius:10px;color:var(--muted)}
.airc-head .x:hover{background:var(--bg-2);color:var(--fg)}
.airc-head .x:focus-visible{outline:2px solid var(--mint)}
.airc-log{overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px;overscroll-behavior:contain}
.airc-msg{max-width:86%;padding:10px 14px;border-radius:16px;font-size:15px;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere;animation:aircIn .35s var(--ease) both}
@keyframes aircIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.airc-msg.u{align-self:flex-end;background:var(--ink);color:var(--on-ink);border-bottom-right-radius:6px}
.airc-msg.a{align-self:flex-start;background:var(--surface);border:1px solid var(--line);border-bottom-left-radius:6px}
.airc-msg.err{border-color:color-mix(in srgb,#e8613c 50%,var(--line));color:var(--fg)}
.airc-msg a{color:var(--mint-ink)}
.airc-src{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;white-space:normal}
.airc-src a{font-size:12px;text-decoration:none;background:var(--mint-soft);color:var(--mint-ink);padding:3px 9px;border-radius:999px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.airc-who{display:flex;align-items:center;gap:6px;font:700 12.5px var(--body);color:var(--mint-ink);margin-bottom:4px;white-space:nowrap}
.airc-who svg{width:18px;height:18px;flex:none}
.airc-who em{font:500 11px var(--mono);font-style:normal;color:var(--muted);letter-spacing:.04em}
.airc-sug{display:flex;flex-wrap:wrap;gap:8px}
.airc-sug button{all:unset;cursor:pointer;font-size:13.5px;padding:7px 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface);transition:border-color .2s}
.airc-sug button:hover{border-color:var(--mint)}
.airc-sug button:focus-visible{outline:2px solid var(--mint)}
.airc-grp{flex-basis:100%;font:500 11px var(--mono);letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin-top:6px}
.airc-grp:first-child{margin-top:0}
.airc-labs button{font-weight:500}
.airc-typing{display:flex;gap:4px;padding:14px}
.airc-typing i{width:7px;height:7px;border-radius:50%;background:var(--muted);animation:aircDot 1.2s infinite}
.airc-typing i:nth-child(2){animation-delay:.15s}.airc-typing i:nth-child(3){animation-delay:.3s}
@keyframes aircDot{0%,80%,100%{opacity:.25;transform:none}40%{opacity:1;transform:translateY(-3px)}}
.airc-form{display:flex;gap:8px;padding:12px;border-top:1px solid var(--line);background:var(--surface)}
.airc-form textarea{flex:1;min-width:0;resize:none;border:1px solid var(--line);border-radius:14px;background:var(--bg);color:var(--fg);font:15px/1.4 var(--body);padding:10px 12px;max-height:120px}
.airc-form textarea:focus{outline:none;border-color:var(--mint)}
.airc-form button{flex:none;width:44px;height:44px;border:0;border-radius:12px;background:var(--mint);color:#fff;cursor:pointer;display:grid;place-items:center;align-self:end;transition:opacity .2s}
.airc-form button:disabled{opacity:.4;cursor:default}
.airc-form button svg{width:18px;height:18px}
.airc-note{font-size:11.5px;color:var(--muted);text-align:center;padding:0 12px 10px;background:var(--surface)}
@media (prefers-reduced-motion:reduce){.airc-fab .dot,.airc-msg,.airc-typing i{animation:none}}
.airc-msg.cards{max-width:100%;width:100%;white-space:normal}
.airc-cards{display:flex;flex-direction:column;gap:8px;margin-top:6px}
.airc-card{display:flex;gap:10px;align-items:flex-start;text-decoration:none;color:inherit;padding:8px;border-radius:12px;border:1px solid var(--line);background:var(--bg);transition:border-color .2s,transform .2s var(--ease)}
.airc-card:hover{border-color:var(--mint);transform:translateY(-1px)}
.airc-card img{flex:none;width:44px;height:55px;object-fit:cover;border-radius:8px;background:var(--bg-2)}
.airc-card .n{flex:none;width:26px;height:26px;border-radius:8px;display:grid;place-items:center;background:var(--ink);color:var(--on-ink);font:700 12px var(--body)}
.airc-card .c{min-width:0;display:flex;flex-direction:column;gap:2px}
.airc-card .k{font:500 10.5px var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--mint-ink)}
.airc-card b{font:600 14px/1.3 var(--body);overflow-wrap:anywhere}
.airc-card .d{font-size:12.5px;line-height:1.4;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.airc-card .m{font:500 11.5px var(--body);color:var(--muted)}
.airc-lead{font-size:14px;line-height:1.45}
.airc-foot{font-size:11.5px;color:var(--muted);margin-top:6px}
.airc-divider{display:flex;align-items:center;gap:10px;margin:6px 0;font-size:11px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#9aa39c)}
.airc-divider::before,.airc-divider::after{content:"";flex:1;height:1px;background:currentColor;opacity:.3}
`;
  var st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);

  var root=document.createElement('div'); root.className='airc';
  root.innerHTML=
    '<button class="airc-fab" type="button" aria-haspopup="dialog" aria-controls="airc-panel">'+LOGO+'<span>Ask AI Radar</span><span class="dot" aria-hidden="true"></span></button>'+
    '<section class="airc-panel" id="airc-panel" role="dialog" aria-label="Ask AI Radar" aria-modal="false">'+
      '<div class="airc-head">'+LOGO+'<div><b>Ask AI Radar</b><span>AI news, tools &amp; tips only</span></div>'+
        '<button class="x" type="button" aria-label="Close chat"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>'+
      '<div class="airc-log" aria-live="polite"></div>'+
      '<div><form class="airc-form"><label for="airc-input" style="position:absolute;left:-9999px">Your question</label>'+
        '<textarea id="airc-input" rows="1" maxlength="500" placeholder="Ask about AI news, tools, tips…"></textarea>'+
        '<button type="submit" aria-label="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></form>'+
      '<div class="airc-note">Answers are AI-generated and can be wrong. Check sources.</div></div>'+
    '</section>';
  document.body.appendChild(root);

  var fab=root.querySelector('.airc-fab'), panel=root.querySelector('.airc-panel'), log=root.querySelector('.airc-log'),
      form=root.querySelector('.airc-form'), input=root.querySelector('textarea'), send=form.querySelector('button'), closeBtn=root.querySelector('.x');
  var history=[]; try{ history=JSON.parse(sessionStorage.getItem(KEY)||'[]'); }catch(e){}
  // One conversation = one session: after 5 minutes without a message the next question starts fresh,
  // so the AI only sees this visitor's current back-and-forth (up to CTX_MAX messages). History stays in this browser tab.
  var SESSION_MS=5*60*1000, CTX_MAX=12;
  function add(m){ m.t=Date.now(); history.push(m); }
  function lastTime(){ for(var i=history.length-1;i>=0;i--){ if(history[i].role!=='divider') return history[i].t||0; } return 0; }
  function sessionMsgs(){ var start=0; for(var i=history.length-1;i>=0;i--){ if(history[i].role==='divider'){ start=i+1; break; } } return history.slice(start).filter(function(m){ return m.role==='user'||m.role==='assistant'; }); }
  function divider(){ var d=document.createElement('div'); d.className='airc-divider'; d.innerHTML='<span>New conversation</span>'; log.appendChild(d); }
  var busy=false;

  function esc(s){ return s.replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function fmt(s){
    var out=esc(s).replace(/\*\*(.+?)\*\*/g,'$1');
    // markdown links [text](url) first, then bare URLs not already inside a link
    out=out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener">$1</a>');
    out=out.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g,'$1<a href="$2" target="_blank" rel="noopener">link</a>');
    return out;
  }
  function cardsHTML(list){
    return '<div class="airc-cards">'+list.map(function(c,i){
      var lead=c.img?'<img src="'+esc(c.img)+'" alt="" loading="lazy">':'<span class="n">'+(i+1)+'</span>';
      var ext=/^https?:\/\/(?!airadar08\.github\.io)/.test(c.url)&&c.url.indexOf(BASE)!==0;
      return '<a class="airc-card" href="'+esc(c.url)+'"'+(ext?' target="_blank" rel="noopener"':'')+'>'+lead+'<span class="c">'+(c.kind?'<span class="k">'+esc(c.kind)+'</span>':'')+'<b>'+esc(c.title)+'</b>'+(c.desc?'<span class="d">'+esc(c.desc)+'</span>':'')+(c.meta?'<span class="m">'+esc(c.meta)+'</span>':'')+'</span></a>';
    }).join('')+'</div>';
  }
  function save(){ try{ sessionStorage.setItem(KEY,JSON.stringify(history.slice(-40))); }catch(e){} }
  function bubble(role,text,extra){
    var d=document.createElement('div'); d.className='airc-msg '+(role==='user'?'u':'a')+(extra&&extra.err?' err':'');
    var note=extra&&extra.site?'<em>· from our resources</em>':extra&&extra.gh?'<em>· searched GitHub</em>':(extra&&extra.web)?'<em>· searched the web</em>':'';
    var tag=role!=='user'?'<span class="airc-who">'+LOGO+'AI Radar'+note+'</span>':'';
    if(extra&&extra.cards){ d.className+=' cards'; d.innerHTML=tag+'<div class="airc-lead">'+esc(extra.lead||'')+'</div>'+cardsHTML(extra.cards)+(extra.foot?'<div class="airc-foot">'+esc(extra.foot)+'</div>':''); log.appendChild(d); log.scrollTop=log.scrollHeight; return d; }
    d.innerHTML=tag+(role==='user'?esc(text):fmt(text));
    if(extra&&extra.sources&&extra.sources.length){
      var s=document.createElement('div'); s.className='airc-src';
      extra.sources.forEach(function(x){ var a=document.createElement('a'); a.href=x.url; a.target='_blank'; a.rel='noopener'; if(x.label){ a.textContent=x.label; } else { try{ a.textContent=new URL(x.url).hostname.replace(/^www\./,''); }catch(e){ a.textContent='source'; } } a.title=x.title; s.appendChild(a); });
      d.appendChild(s);
    }
    log.appendChild(d); log.scrollTop=log.scrollHeight; return d;
  }
  function welcome(){
    bubble('assistant',"Hi! I answer AI questions only: news, models, tools, tips and spreadsheets with AI. Which AI company do you want the latest on? Pick one, or type your question.");
    var w=document.createElement('div'); w.className='airc-sug airc-labs';
    function chip(label,q){ var b=document.createElement('button'); b.type='button'; b.textContent=label; b.onclick=function(){ w.remove(); ask(q); }; return b; }
    LABS.forEach(function(grp){
      var h=document.createElement('span'); h.className='airc-grp'; h.textContent=grp.g; w.appendChild(h);
      grp.items.forEach(function(it){ w.appendChild(chip(it[0],"Latest "+it[1]+" news")); });
    });
    var h2=document.createElement('span'); h2.className='airc-grp'; h2.textContent='Or try'; w.appendChild(h2);
    SUGGEST.forEach(function(q){ w.appendChild(chip(q,q)); });
    log.appendChild(w);
  }
  function render(){ log.innerHTML=''; welcome(); history.forEach(function(m){ if(m.role==='divider') divider(); else bubble(m.role,m.content,m.meta); }); }

  async function ask(q){
    q=q.trim(); if(!q||busy) return;
    var sug=log.querySelector('.airc-sug'); if(sug) sug.remove();
    busy=true; send.disabled=true;
    if(history.length&&Date.now()-lastTime()>SESSION_MS&&history[history.length-1].role!=='divider'){ add({role:'divider'}); divider(); }
    add({role:'user',content:q}); bubble('user',q); save();
    function typing(){ var t=document.createElement('div'); t.className='airc-msg a airc-typing'; t.setAttribute('aria-label','Thinking'); t.innerHTML='<i></i><i></i><i></i>'; log.appendChild(t); log.scrollTop=log.scrollHeight; return t; }
    var t=typing();
    // Step 1: our own resources first
    var site=[]; try{ site=matchSite(q,await loadIndex()); }catch(e){}
    var isRepo=REPO_Q.test(q);
    if(site.length){
      t.remove();
      var cards=site.map(function(it){ return {kind:it.kind,title:it.title,desc:it.desc,img:it.img,url:it.url}; });
      var lead=site.length===1?'We have this on AI Radar:':'From our AI Radar resources:';
      var m1={site:true,cards:cards,lead:lead};
      add({role:'assistant',content:lead+' '+site.map(function(i){return i.kind+': '+i.title;}).join('; '),meta:m1}); bubble('assistant','',m1); save();
      t=typing();
    }
    // Step 2a: repo questions -> live GitHub search
    if(isRepo){
      try{
        var g=await githubTop(q);
        if(g.items.length){
          t.remove();
          var what=g.topic?g.topic+' ':'';
          var lead2=(site.length?'And ':'')+'Top '+g.items.length+' '+what+(g.aiQ?'AI ':'')+'repos on GitHub'+(g.fresh?' right now:':':');
          var foot=g.fresh?'Most-starred repos created since '+g.since+', live from GitHub search.':'Most-starred, still actively updated repos, live from GitHub search.';
          function ghCard(r){ return {title:r.name,desc:r.desc,url:r.url,meta:'\u2605 '+kfmt(r.stars)+(r.lang?' \u00b7 '+r.lang:'')}; }
          var m2={gh:true,lead:lead2,foot:foot,cards:g.items.map(ghCard)};
          add({role:'assistant',content:lead2+' '+g.items.map(function(r,i){return (i+1)+'. '+r.name+' ('+kfmt(r.stars)+' stars)';}).join('; '),meta:m2}); bubble('assistant','',m2);
          if(g.extra.length){
            var m3={gh:true,lead:'New AI repos for '+(g.topic||'this')+':',foot:'Created in the last 6 months, live from GitHub search.',cards:g.extra.map(ghCard)};
            add({role:'assistant',content:m3.lead+' '+g.extra.map(function(r){ return r.name; }).join('; '),meta:m3}); bubble('assistant','',m3);
          }
          save(); busy=false; send.disabled=false; input.focus(); return;
        }
      }catch(e){ /* GitHub limit or offline: fall through to the AI answer */ }
    }
    // Step 2b: AI answer with web news
    try{
      // keep roles alternating: resource/GitHub turns go in as short assistant summaries, same-role neighbours are merged
      var msgs=[]; sessionMsgs().forEach(function(m){ var last=msgs[msgs.length-1]; if(last&&last.role===m.role){ last.content+='\n'+m.content; } else msgs.push({role:m.role,content:m.content}); });
      while(msgs.length&&msgs[msgs.length-1].role!=='user') msgs.pop(); // this turn's resource cards stay on screen only
      msgs=msgs.slice(-CTX_MAX); while(msgs.length&&msgs[0].role!=='user') msgs.shift();
      var payload=JSON.stringify({messages:msgs});
      var r,data;
      for(var attempt=0;attempt<2;attempt++){ // retry once if the model returns an empty answer
        r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:payload,signal:(window.AbortSignal&&AbortSignal.timeout)?AbortSignal.timeout(40000):undefined});
        data=await r.json().catch(function(){return {};});
        if(!(r.ok&&data.reply&&/^Sorry, I couldn't come up with an answer/.test(data.reply))) break;
      }
      t.remove();
      if(!r.ok||!data.reply){ bubble('assistant',data.error||'Something went wrong. Try again.',{err:true}); history.pop(); }
      else{
        if(data.finish==='length'){ // answer hit the length cap: cut back to the last complete sentence or bullet
          var txt=data.reply, cut=Math.max(txt.lastIndexOf('. '),txt.lastIndexOf('.\n'),txt.lastIndexOf(')\n'),txt.lastIndexOf('\n- '));
          if(cut>txt.length*0.4) data.reply=txt.slice(0,cut+1).trim();
        }
        var offTopic=/\bonly (cover|help with|answer)\b[^.]*\bAI\b/i.test(data.reply);
        var meta={sources:offTopic?[]:(data.sources||[]),web:!offTopic&&!!data.web}; add({role:'assistant',content:data.reply,meta:meta}); bubble('assistant',data.reply,meta); }
    }catch(e){ t.remove(); bubble('assistant',"Couldn't connect. Check your internet and try again.",{err:true}); history.pop(); }
    save(); busy=false; send.disabled=false; input.focus();
  }

  function open(){ document.documentElement.classList.add('airc-open'); if(!log.childElementCount) render(); setTimeout(function(){ input.focus(); },250); }
  function close(){ document.documentElement.classList.remove('airc-open'); fab.focus(); }
  fab.addEventListener('click',open); closeBtn.addEventListener('click',close);
  document.addEventListener('keydown',function(e){ if(e.key==='Escape'&&document.documentElement.classList.contains('airc-open')) close(); });
  form.addEventListener('submit',function(e){ e.preventDefault(); var q=input.value; input.value=''; input.style.height=''; ask(q); });
  input.addEventListener('keydown',function(e){ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); form.requestSubmit(); } });
  input.addEventListener('input',function(){ input.style.height='auto'; input.style.height=Math.min(input.scrollHeight,120)+'px'; });
  // deep link: airadar08.github.io/#ask opens the chat; other scripts can call AIRadarChat.open()
  window.AIRadarChat={open:open,close:close,ask:function(q){ open(); ask(q); }};
  document.addEventListener('click',function(e){ var a=e.target.closest&&e.target.closest('[data-open-chat]'); if(a){ e.preventDefault(); open(); } });
  if(location.hash==='#ask') open();
})();
