// AI Radar hero: a flat radar seen straight on. Rings and a sweep beam spread up from the bottom centre of the hero;
// coloured blips light up as the beam passes and briefly show a name tag. Blips are placed only in open space,
// never behind the hero copy or the phones. Plain 2D canvas, no libraries.
(function(){
  var host=document.getElementById('radar');
  if(!host) return;
  var hero=host.closest('.hero'); if(!hero) return;
  var canvas=document.createElement('canvas'); host.appendChild(canvas); host.classList.add('live');
  var ctx=canvas.getContext('2d');
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MINT='52,201,138';
  // the 8 post-card slot colours
  var SLOTS=['#e0b400','#34c98a','#4a90f0','#9b7cf0','#f07a4f','#ff8a2a','#22b4c2','#ef5f92'];
  var NAMES=['OpenAI','Anthropic','Google DeepMind','Meta AI','Mistral AI','DeepSeek','xAI','NVIDIA','Hugging Face','Microsoft','Qwen','Perplexity','AI NEWS','UPDATES','AI FACTS'];
  var W=0,H=0,DPR=1,cx=0,cy=0,RMAX=0,blips=[],seed=11;
  function rnd(){ seed=(seed*9301+49297)%233280; return seed/233280; }

  function rectIn(el,pad){
    if(!el) return null;
    var r=el.getBoundingClientRect(), h=hero.getBoundingClientRect();
    return {l:r.left-h.left-pad,t:r.top-h.top-pad,r:r.right-h.left+pad,b:r.bottom-h.top+pad};
  }
  function inside(x,y,k){ return k && x>k.l && x<k.r && y>k.t && y<k.b; }

  function layout(){
    W=hero.clientWidth; H=hero.clientHeight; if(!W||!H) return;
    DPR=Math.min(window.devicePixelRatio||1,2);
    canvas.width=Math.round(W*DPR); canvas.height=Math.round(H*DPR);
    canvas.style.width=W+'px'; canvas.style.height=H+'px';
    cx=W/2; cy=H+H*0.06;                        // centre just below the hero's bottom edge
    RMAX=Math.hypot(Math.max(cx,W-cx),cy)+40;
    // keep blips out of the copy and the phones (and their tags out of the nav band)
    var copy=rectIn(hero.querySelector('.hero-copy'),28);
    var phones=rectIn(hero.querySelector('.phone-stage'),10);
    if(phones){ phones.l+=30; phones.r-=30; }
    seed=11; blips=[];
    var tries=0, named=0, small=W<700;
    var want=small?14:24, wantNamed=small?6:12;
    while(blips.length<want && tries<4000){
      tries++;
      var ang=Math.PI+0.12+rnd()*(Math.PI-0.24);       // upper half, away from the flat horizon
      var rad=RMAX*(0.18+rnd()*0.72);
      var x=cx+Math.cos(ang)*rad, y=cy+Math.sin(ang)*rad;
      if(x<24||x>W-24||y<110||y>H-20) continue;
      if(inside(x,y,copy)||inside(x,y,phones)) continue;
      var labelled=named<wantNamed;
      // a labelled blip needs room for its tag above it
      if(labelled && (inside(x,y-26,copy)||inside(x+50,y-26,copy)||inside(x-50,y-26,copy)||y<140)) labelled=false;
      if(blips.some(function(b){ return Math.hypot(b.x-x,b.y-y)<(labelled||b.name?120:46); })) continue;
      var b={x:x,y:y,ang:(ang+Math.PI*2)%(Math.PI*2),r:3+rnd()*2.5,col:SLOTS[blips.length%SLOTS.length],glow:reduce?0.6:0,name:labelled?NAMES[named%NAMES.length]:null};
      if(labelled) named++;
      blips.push(b);
    }
  }

  var sweep=Math.PI*1.05, last=performance.now(), running=true, raf=0;
  function draw(now){
    var dt=Math.min((now-last)/1000,0.05); last=now;
    var prev=sweep; sweep=(sweep+dt*0.55)%(Math.PI*2);
    ctx.setTransform(DPR,0,0,DPR,0,0); ctx.clearRect(0,0,W,H);
    // rings and ticks
    for(var i=1;i<=7;i++){
      var r=RMAX*i/7;
      ctx.beginPath(); ctx.arc(cx,cy,r,Math.PI,Math.PI*2);
      ctx.strokeStyle='rgba('+MINT+','+(i===7?0.3:0.16)+')'; ctx.lineWidth=1; ctx.stroke();
    }
    for(var s=0;s<=12;s++){
      var a=Math.PI+s/12*Math.PI;
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(a)*RMAX,cy+Math.sin(a)*RMAX);
      ctx.strokeStyle='rgba('+MINT+',0.06)'; ctx.stroke();
    }
    // sweep beam: a soft wedge trailing the leading edge
    var SPAN=0.8, STEPS=24;
    for(var k=0;k<STEPS;k++){
      var a0=sweep-SPAN+k*SPAN/STEPS, a1=a0+SPAN/STEPS+0.004, al=0.2*Math.pow((k+1)/STEPS,2.2);
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,RMAX,a0,a1); ctx.closePath();
      ctx.fillStyle='rgba('+MINT+','+al.toFixed(3)+')'; ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx+Math.cos(sweep)*RMAX,cy+Math.sin(sweep)*RMAX);
    ctx.strokeStyle='rgba('+MINT+',0.55)'; ctx.lineWidth=1.5; ctx.stroke(); ctx.lineWidth=1;
    // blips
    blips.forEach(function(b){
      if(!reduce){
        var passed = prev<=sweep ? (b.ang>prev && b.ang<=sweep) : (b.ang>prev || b.ang<=sweep);
        if(passed) b.glow=1;
        b.glow*=Math.pow(b.name?0.55:0.3,dt);
      }
      var gl=b.glow;
      // ping ring
      if(gl>0.05){ ctx.beginPath(); ctx.arc(b.x,b.y,b.r+(1-gl)*16,0,Math.PI*2); ctx.strokeStyle=hexA(b.col,0.6*gl*gl); ctx.stroke(); }
      ctx.beginPath(); ctx.arc(b.x,b.y,b.r*(1+0.5*gl),0,Math.PI*2); ctx.fillStyle=hexA(b.col,0.5+0.5*gl); ctx.fill();
      if(b.name){
        var a=Math.max(0,Math.min(1,(gl-0.12)/0.4)); a=a*a*(3-2*a);
        if(a>0.02) tag(b,a);
      }
    });
  }
  function tag(b,a){
    ctx.font='500 11px "JetBrains Mono", ui-monospace, Menlo, monospace';
    var text=b.name.toUpperCase(), tw=ctx.measureText(text).width, pw=tw+28, ph=24;
    var x=Math.max(8,Math.min(W-pw-8,b.x-pw/2)), y=b.y-ph-12-(1-a)*6;
    ctx.globalAlpha=a;
    roundRect(x,y,pw,ph,12); ctx.fillStyle='rgba(17,20,18,0.9)'; ctx.fill(); ctx.strokeStyle='rgba(255,255,255,0.12)'; ctx.stroke();
    ctx.beginPath(); ctx.arc(x+12,y+ph/2,3.5,0,Math.PI*2); ctx.fillStyle=b.col; ctx.fill();
    ctx.fillStyle='#eef1ee'; ctx.textBaseline='middle'; ctx.fillText(text,x+21,y+ph/2+0.5);
    // stem to the dot
    ctx.beginPath(); ctx.moveTo(b.x,b.y-b.r-3); ctx.lineTo(b.x,y+ph); ctx.strokeStyle=hexA(b.col,0.7); ctx.stroke();
    ctx.globalAlpha=1;
  }
  function roundRect(x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
  function hexA(hex,a){ var n=parseInt(hex.slice(1),16); return 'rgba('+(n>>16)+','+((n>>8)&255)+','+(n&255)+','+a.toFixed(3)+')'; }

  function loop(){ cancelAnimationFrame(raf); (function tick(now){ if(!running||document.hidden) return; draw(now); raf=requestAnimationFrame(tick); })(performance.now()); }
  var rz; addEventListener('resize',function(){ clearTimeout(rz); rz=setTimeout(function(){ layout(); if(reduce) draw(performance.now()); },120); });
  // re-place blips once fonts and the phones have settled into their final positions
  layout(); setTimeout(layout,1800);
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(layout);
  if('IntersectionObserver' in window) new IntersectionObserver(function(es){ running=es[0].isIntersecting; if(running&&!reduce) loop(); }).observe(hero);
  document.addEventListener('visibilitychange',function(){ if(!document.hidden&&running&&!reduce) loop(); });
  if(reduce){ blips.forEach(function(b){ b.glow=b.name?1:0.5; }); draw(performance.now()); } else loop();
})();
