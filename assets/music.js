// AI Radar background music: an original ambient loop made live with the Web Audio API (no audio file, no copyright).
// A soft pad drifts through four chords with a quiet "radar ping" echoing over it.
// Browsers only allow sound after the visitor interacts, so it starts on the first click / tap / key press anywhere,
// unless the visitor paused it before (remembered in localStorage "airadar-music"). The round button in the top bar
// (inserted just before "Follow on X") pauses and plays it. It fades out while the tab is hidden.
(function(){
  'use strict';
  var KEY='airadar-music', AC=window.AudioContext||window.webkitAudioContext;
  if(!AC) return;
  var pref=null; try{ pref=localStorage.getItem(KEY); }catch(e){}
  var ctx=null, master=null, playing=false, timer=null, nextAt=0, step=0, btn=null;
  var VOL=0.13;

  // chords (Hz): Am9, Fmaj7, Cmaj9, Em7 — slow, calm, a little hopeful
  var CHORDS=[[110,220,261.63,329.63,493.88],[87.31,174.61,220,261.63,329.63],[130.81,196,246.94,293.66,329.63],[82.41,164.81,196,246.94,293.66]];
  var BAR=8;                                   // seconds per chord
  var PINGS=[987.77,880,783.99,659.25];        // B5 A5 G5 E5, one per chord

  function build(){
    ctx=new AC();
    master=ctx.createGain(); master.gain.value=0; master.connect(ctx.destination);
    // a gentle low-pass keeps the pad soft
    var lp=ctx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value=1400; lp.Q.value=0.3; lp.connect(master);
    master._in=lp;
    // echo for the pings
    var dl=ctx.createDelay(2), fb=ctx.createGain(), wet=ctx.createGain();
    dl.delayTime.value=0.42; fb.gain.value=0.38; wet.gain.value=0.5;
    dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(master);
    master._echo=dl;
  }
  function pad(freqs,t){
    freqs.forEach(function(f,i){
      [-4,4].forEach(function(cents){
        var o=ctx.createOscillator(), g=ctx.createGain();
        o.type=i===0?'sine':'triangle'; o.frequency.value=f; o.detune.value=cents;
        var peak=(i===0?0.22:0.09)/2;
        g.gain.setValueAtTime(0,t);
        g.gain.linearRampToValueAtTime(peak,t+2.6);            // slow swell in
        g.gain.setValueAtTime(peak,t+BAR-1.2);
        g.gain.linearRampToValueAtTime(0,t+BAR+1.8);           // overlap into the next chord
        o.connect(g); g.connect(master._in); o.start(t); o.stop(t+BAR+2);
      });
    });
  }
  function ping(f,t){
    var o=ctx.createOscillator(), g=ctx.createGain();
    o.type='sine'; o.frequency.setValueAtTime(f,t);
    g.gain.setValueAtTime(0,t); g.gain.linearRampToValueAtTime(0.07,t+0.01); g.gain.exponentialRampToValueAtTime(0.0008,t+1.6);
    o.connect(g); g.connect(master); g.connect(master._echo); o.start(t); o.stop(t+1.7);
  }
  // schedule a little ahead so timing stays smooth
  function schedule(){
    while(nextAt<ctx.currentTime+BAR){
      var c=step%CHORDS.length;
      pad(CHORDS[c],nextAt);
      ping(PINGS[c],nextAt+2);
      if(step%2===1) ping(PINGS[(c+2)%4],nextAt+6);
      nextAt+=BAR; step++;
    }
  }
  function fade(to,sec){ var t=ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value,t); master.gain.linearRampToValueAtTime(to,t+sec); }

  function play(){
    if(!ctx) build();
    if(ctx.state==='suspended') ctx.resume();
    if(!timer){ nextAt=Math.max(nextAt,ctx.currentTime+0.05); schedule(); timer=setInterval(schedule,2000); }
    fade(VOL,2.5); playing=true; sync();
  }
  function pause(){
    if(!ctx){ playing=false; sync(); return; }
    fade(0,0.6); playing=false; sync();
    setTimeout(function(){ if(!playing){ clearInterval(timer); timer=null; ctx.suspend(); } },700);
  }
  function remember(v){ pref=v; try{ localStorage.setItem(KEY,v); }catch(e){} }

  // ---- the button ----
  var ICON_PLAY='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';
  var ICON_PAUSE='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5.5" width="4" height="13" rx="1.2" fill="currentColor"/><rect x="13.5" y="5.5" width="4" height="13" rx="1.2" fill="currentColor"/></svg>';
  function sync(){
    if(!btn) return;
    btn.innerHTML=(playing?ICON_PAUSE:ICON_PLAY)+'<span class="air-music-bars" aria-hidden="true"><i></i><i></i><i></i></span>';
    btn.classList.toggle('on',playing);
    btn.setAttribute('aria-pressed',playing?'true':'false');
    btn.setAttribute('aria-label',playing?'Pause background music':'Play background music');
    btn.title=playing?'Pause music':'Play music';
  }
  function addButton(){
    var follow=document.querySelector('header .nav-pill > a.btn, .site-head .nav a.btn');
    if(!follow) return;
    var css=document.createElement('style');
    css.textContent='.air-music{position:relative;flex:none;width:40px;height:40px;margin-right:8px;border-radius:50%;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.05);color:#eef1ee;display:inline-grid;place-items:center;cursor:pointer;padding:0;transition:background .2s,border-color .2s,color .2s}'+
      '.air-music:hover{background:rgba(255,255,255,.1)}.air-music.on{color:#6fdcaa;border-color:rgba(52,201,138,.45);background:rgba(52,201,138,.1)}'+
      '.air-music svg{width:16px;height:16px}.air-music:focus-visible{outline:2px solid #34c98a;outline-offset:2px}'+
      '.air-music-bars{position:absolute;bottom:-3px;left:50%;transform:translateX(-50%);display:none;gap:2px;align-items:flex-end;height:6px}'+
      '.air-music.on .air-music-bars{display:flex}.air-music-bars i{width:2px;height:3px;border-radius:1px;background:#34c98a;animation:airMusic 1.1s ease-in-out infinite}'+
      '.air-music-bars i:nth-child(2){animation-delay:.2s}.air-music-bars i:nth-child(3){animation-delay:.4s}'+
      '@keyframes airMusic{0%,100%{height:2px}50%{height:6px}}'+
      '@media (prefers-reduced-motion:reduce){.air-music-bars i{animation:none;height:4px}}'+
      '.site-head .nav .air-music{margin:0 0 0 6px}';
    document.head.appendChild(css);
    btn=document.createElement('button'); btn.type='button'; btn.className='air-music';
    if(follow.parentNode.classList.contains('nav-pill')){
      // home bar spreads its items apart, so keep the button and "Follow on X" together in one group
      var grp=document.createElement('span'); grp.style.cssText='display:flex;align-items:center';
      follow.parentNode.insertBefore(grp,follow); grp.appendChild(btn); grp.appendChild(follow);
    } else follow.parentNode.insertBefore(btn,follow);
    btn.addEventListener('click',function(e){ e.stopPropagation(); if(playing){ pause(); remember('off'); } else { play(); remember('on'); } });
    sync();
  }

  // first interaction anywhere starts the music (unless the visitor paused it before)
  function first(e){
    ['pointerdown','keydown','touchstart'].forEach(function(t){ document.removeEventListener(t,first,true); });
    if(pref==='off'||playing) return;
    if(btn&&e&&btn.contains(e.target)) return;   // the button's own click handles it
    play();
  }
  ['pointerdown','keydown','touchstart'].forEach(function(t){ document.addEventListener(t,first,true); });

  // quiet while the tab is hidden
  var wasPlaying=false;
  document.addEventListener('visibilitychange',function(){
    if(!ctx) return;
    if(document.hidden){ wasPlaying=playing; if(playing){ fade(0,0.4); setTimeout(function(){ if(document.hidden) ctx.suspend(); },450); } }
    else if(wasPlaying){ ctx.resume(); fade(VOL,1.2); }
  });

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',addButton); else addButton();
})();
