// "Ask AI Radar" chat overlay. Talks to the Cloudflare Worker (worker/worker.js), which holds the API key.
// Stays hidden until ENDPOINT is set to the Worker's URL.
(function(){
  var ENDPOINT = ""; // e.g. "https://airadar-chat.<your-subdomain>.workers.dev"
  if(!ENDPOINT) return;

  var LOGO='<svg viewBox="0 0 400 400" aria-hidden="true"><circle cx="200" cy="200" r="194" fill="#13a36b" stroke="#0f8a5a" stroke-width="8"/><g transform="translate(189 195) scale(0.74) translate(-224 -166)"><text x="182" y="285" text-anchor="middle" font-family="Inter,Helvetica,Arial,sans-serif" font-weight="900" font-size="230" letter-spacing="-10" fill="#ffffff">a</text><rect x="268" y="160" width="40" height="125" rx="6" fill="#ffffff"/><circle cx="288" cy="112" r="24" fill="#1d1d1f"/><path d="M299.4 69.5 A44 44 0 0 1 330.5 100.6" stroke="#1d1d1f" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.85"/><path d="M305.1 48.2 A66 66 0 0 1 351.8 94.9" stroke="#1d1d1f" stroke-width="7" fill="none" stroke-linecap="round" opacity="0.55"/></g></svg>';
  var SUGGEST=["What's new in AI this week?","Explain RAG in simple words","Best free AI tools for students?","What is an AI agent?"];
  var KEY='air-chat-v1';

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
.airc-tag{font:500 11px var(--mono);color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:4px;display:block}
.airc-sug{display:flex;flex-wrap:wrap;gap:8px}
.airc-sug button{all:unset;cursor:pointer;font-size:13.5px;padding:7px 12px;border-radius:999px;border:1px solid var(--line);background:var(--surface);transition:border-color .2s}
.airc-sug button:hover{border-color:var(--mint)}
.airc-sug button:focus-visible{outline:2px solid var(--mint)}
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
`;
  var st=document.createElement('style'); st.textContent=css; document.head.appendChild(st);

  var root=document.createElement('div'); root.className='airc';
  root.innerHTML=
    '<button class="airc-fab" type="button" aria-haspopup="dialog" aria-controls="airc-panel">'+LOGO+'<span>Ask AI Radar</span><span class="dot" aria-hidden="true"></span></button>'+
    '<section class="airc-panel" id="airc-panel" role="dialog" aria-label="Ask AI Radar" aria-modal="false">'+
      '<div class="airc-head">'+LOGO+'<div><b>Ask AI Radar</b><span>AI news and answers, kept short</span></div>'+
        '<button class="x" type="button" aria-label="Close chat"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div>'+
      '<div class="airc-log" aria-live="polite"></div>'+
      '<div><form class="airc-form"><label for="airc-input" style="position:absolute;left:-9999px">Your question</label>'+
        '<textarea id="airc-input" rows="1" maxlength="500" placeholder="Ask about AI, news, tools…"></textarea>'+
        '<button type="submit" aria-label="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></form>'+
      '<div class="airc-note">Answers are AI-generated and can be wrong. Check sources.</div></div>'+
    '</section>';
  document.body.appendChild(root);

  var fab=root.querySelector('.airc-fab'), panel=root.querySelector('.airc-panel'), log=root.querySelector('.airc-log'),
      form=root.querySelector('.airc-form'), input=root.querySelector('textarea'), send=form.querySelector('button'), closeBtn=root.querySelector('.x');
  var history=[]; try{ history=JSON.parse(sessionStorage.getItem(KEY)||'[]'); }catch(e){}
  var busy=false;

  function esc(s){ return s.replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function fmt(s){
    return esc(s).replace(/\*\*(.+?)\*\*/g,'$1').replace(/(https?:\/\/[^\s<)]+)/g,'<a href="$1" target="_blank" rel="noopener">$1</a>');
  }
  function save(){ try{ sessionStorage.setItem(KEY,JSON.stringify(history.slice(-20))); }catch(e){} }
  function bubble(role,text,extra){
    var d=document.createElement('div'); d.className='airc-msg '+(role==='user'?'u':'a')+(extra&&extra.err?' err':'');
    var tag=(role!=='user'&&extra&&extra.web)?'<span class="airc-tag">Searched the web</span>':'';
    d.innerHTML=tag+(role==='user'?esc(text):fmt(text));
    if(extra&&extra.sources&&extra.sources.length){
      var s=document.createElement('div'); s.className='airc-src';
      extra.sources.forEach(function(x){ var a=document.createElement('a'); a.href=x.url; a.target='_blank'; a.rel='noopener'; try{ a.textContent=new URL(x.url).hostname.replace(/^www\./,''); }catch(e){ a.textContent='source'; } a.title=x.title; s.appendChild(a); });
      d.appendChild(s);
    }
    log.appendChild(d); log.scrollTop=log.scrollHeight; return d;
  }
  function welcome(){
    bubble('assistant',"Hi! Ask me anything about AI: today's news, how a tool works, or what a term means. I'll keep it short.");
    var w=document.createElement('div'); w.className='airc-sug';
    SUGGEST.forEach(function(q){ var b=document.createElement('button'); b.type='button'; b.textContent=q; b.onclick=function(){ w.remove(); ask(q); }; w.appendChild(b); });
    log.appendChild(w);
  }
  function render(){ log.innerHTML=''; welcome(); history.forEach(function(m){ bubble(m.role,m.content,m.meta); }); }

  async function ask(q){
    q=q.trim(); if(!q||busy) return;
    var sug=log.querySelector('.airc-sug'); if(sug) sug.remove();
    busy=true; send.disabled=true;
    history.push({role:'user',content:q}); bubble('user',q); save();
    var t=document.createElement('div'); t.className='airc-msg a airc-typing'; t.setAttribute('aria-label','Thinking'); t.innerHTML='<i></i><i></i><i></i>'; log.appendChild(t); log.scrollTop=log.scrollHeight;
    try{
      var r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({messages:history.map(function(m){return {role:m.role,content:m.content};}).slice(-6)})});
      var data=await r.json().catch(function(){return {};});
      t.remove();
      if(!r.ok||!data.reply){ bubble('assistant',data.error||'Something went wrong. Try again.',{err:true}); history.pop(); }
      else{ var meta={sources:data.sources||[],web:!!data.web}; history.push({role:'assistant',content:data.reply,meta:meta}); bubble('assistant',data.reply,meta); }
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
  // deep link: airadar08.github.io/#ask opens the chat
  if(location.hash==='#ask') open();
})();
