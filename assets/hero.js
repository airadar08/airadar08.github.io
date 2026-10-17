// AI Radar hero: a tilted 3D radar scope. A sweep beam rotates; "blips" (stories) light up as it passes.
// Needs THREE (r128 UMD). Falls back to the static SVG in #radar if WebGL or THREE is missing.
(function(){
  var host=document.getElementById('radar');
  if(!host||!window.THREE) return;
  var reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the site is dark-only now; keep the dark palette regardless of the device setting
  var dark={matches:true};
  var renderer;
  try{ renderer=new THREE.WebGLRenderer({antialias:true,alpha:true}); }catch(e){ return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,2));
  renderer.setClearColor(0x000000,0);
  host.appendChild(renderer.domElement);
  host.classList.add('live');

  var scene=new THREE.Scene();
  var camera=new THREE.PerspectiveCamera(36,1,0.1,100);
  camera.position.set(0,0,16.5);

  var MINT=new THREE.Color('#13a36b'), INK=new THREE.Color('#1d1d1f');
  function palette(){ MINT.set(dark.matches?'#34c98a':'#13a36b'); INK.set(dark.matches?'#eeede6':'#1d1d1f'); }
  palette();

  var scope=new THREE.Group();
  scope.rotation.x=-1.02; scope.rotation.z=0.25;
  scene.add(scope);

  var R=4.6, mats=[];
  function line(geo,op){ var m=new THREE.LineBasicMaterial({color:MINT,transparent:true,opacity:op}); mats.push(m); return new THREE.Line(geo,m); }
  // rings
  [1,2,3,4].forEach(function(i){
    var r=R*i/4, pts=[];
    for(var a=0;a<=128;a++){ var t=a/128*Math.PI*2; pts.push(new THREE.Vector3(Math.cos(t)*r,Math.sin(t)*r,0)); }
    scope.add(line(new THREE.BufferGeometry().setFromPoints(pts), i===4?0.55:0.22));
  });
  // spokes
  for(var s=0;s<12;s++){
    var t=s/12*Math.PI*2;
    scope.add(line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(Math.cos(t)*R,Math.sin(t)*R,0)]),0.1));
  }
  // tick marks on the outer ring
  var ticks=[];
  for(var k=0;k<72;k++){ var a=k/72*Math.PI*2, l=k%6===0?0.32:0.14; ticks.push(new THREE.Vector3(Math.cos(a)*R,Math.sin(a)*R,0),new THREE.Vector3(Math.cos(a)*(R+l),Math.sin(a)*(R+l),0)); }
  var tm=new THREE.LineBasicMaterial({color:MINT,transparent:true,opacity:0.45}); mats.push(tm);
  scope.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks),tm));

  // faint disc
  var discMat=new THREE.MeshBasicMaterial({color:MINT,transparent:true,opacity:0.05,side:THREE.DoubleSide});
  scope.add(new THREE.Mesh(new THREE.CircleGeometry(R,96),discMat));

  // sweep beam: angular gradient, brightest at the leading edge
  var SPAN=1.1;
  var sweepMat=new THREE.ShaderMaterial({
    transparent:true, depthWrite:false, side:THREE.DoubleSide,
    uniforms:{uColor:{value:MINT}, uSpan:{value:SPAN}},
    vertexShader:'varying vec2 vP; void main(){ vP=position.xy; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'uniform vec3 uColor; uniform float uSpan; varying vec2 vP; void main(){ float a=atan(vP.y,vP.x); if(a<0.0) a+=6.2831853; float t=clamp(a/uSpan,0.0,1.0); float r=length(vP)/'+R.toFixed(1)+'; float al=pow(t,2.4)*0.55*(0.35+0.65*r); gl_FragColor=vec4(uColor,al);}'
  });
  var sweep=new THREE.Mesh(new THREE.CircleGeometry(R,96,0,SPAN),sweepMat);
  sweep.position.z=0.01; scope.add(sweep);
  // leading edge line
  var edgeMat=new THREE.LineBasicMaterial({color:MINT,transparent:true,opacity:0.9}); mats.push(edgeMat);
  var edge=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0.02),new THREE.Vector3(Math.cos(SPAN)*R,Math.sin(SPAN)*R,0.02)]),edgeMat);
  scope.add(edge);

  // centre hub
  var hubMat=new THREE.MeshBasicMaterial({color:MINT});
  var hub=new THREE.Mesh(new THREE.SphereGeometry(0.14,24,16),hubMat); scope.add(hub);

  // blips: little stories that light up when the beam passes
  // blip colours = the 8 post-card slot accents (Sunflower, Mint, Sky, Lavender, Coral, Graphite, Teal, Rose)
  var SLOTS=['#d9a400','#13a36b','#2f7ae5','#7c5ce0','#e8613c','#ff7a1a','#0e9aa7','#e0457b'];
  var blips=[], seed=7;
  // some blips "project" a label showing what they are
  var TAGGED=[2,7,12], TAG_TEXT=['AI NEWS','UPDATES','AI FACTS'];
  var TAG_POS=[[0.45,0.9],[2.7,0.9],[6.0,0.92]];  // [angle, radius share of R]: right-back, left-back, right-front: out at the rim, clear of the phones in the middle
  var tags=document.createElement('div'); tags.className='rtags'; host.appendChild(tags);
  var tmpV=new THREE.Vector3();
  function rnd(){ seed=(seed*9301+49297)%233280; return seed/233280; }
  for(var b=0;b<16;b++){
    var ang=rnd()*Math.PI*2, rad=R*(0.22+rnd()*0.72);
    var col=new THREE.Color(SLOTS[b%SLOTS.length]);
    var m=new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:0.25});
    var mesh=new THREE.Mesh(new THREE.SphereGeometry(0.075+rnd()*0.05,16,12),m);
    mesh.position.set(Math.cos(ang)*rad,Math.sin(ang)*rad,0.05);
    var ringPts=[]; for(var q=0;q<=40;q++){ var qa=q/40*Math.PI*2; ringPts.push(new THREE.Vector3(Math.cos(qa)*0.18,Math.sin(qa)*0.18,0)); }
    var ringM=new THREE.LineBasicMaterial({color:col,transparent:true,opacity:0});
    var ring=new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts),ringM); ring.position.copy(mesh.position);
    scope.add(mesh); scope.add(ring);
    var bl={mesh:mesh,ring:ring,ang:ang,glow:0,col:SLOTS[b%SLOTS.length]};
    var li=TAGGED.indexOf(b);
    if(li>-1){
      var tp=TAG_POS[li]; mesh.position.set(Math.cos(tp[0])*R*tp[1],Math.sin(tp[0])*R*tp[1],0.05); ring.position.copy(mesh.position);
      bl.ang=(tp[0]+Math.PI*2)%(Math.PI*2); mesh.scale.setScalar(1.25);
      var H=1.35;
      var lm=new THREE.LineBasicMaterial({color:col,transparent:true,opacity:0});
      var stem=new THREE.Line(new THREE.BufferGeometry().setFromPoints([mesh.position.clone(),mesh.position.clone().add(new THREE.Vector3(0,0,H))]),lm);
      scope.add(stem);
      var tag=document.createElement('span'); tag.className='rtag';
      tag.innerHTML='<i style="background:'+bl.col+'"></i>'+TAG_TEXT[li%TAG_TEXT.length];
      tags.appendChild(tag);
      bl.stem=stem; bl.tag=tag; bl.top=mesh.position.clone().add(new THREE.Vector3(0,0,H));
    }
    blips.push(bl);
  }

  // drifting dust
  var N=160, pos=new Float32Array(N*3);
  for(var i=0;i<N;i++){ pos[i*3]=(rnd()-.5)*18; pos[i*3+1]=(rnd()-.5)*12; pos[i*3+2]=(rnd()-.5)*8-2; }
  var dg=new THREE.BufferGeometry(); dg.setAttribute('position',new THREE.BufferAttribute(pos,3));
  var dustMat=new THREE.PointsMaterial({color:MINT,size:0.045,transparent:true,opacity:0.5});
  var dust=new THREE.Points(dg,dustMat); scene.add(dust);

  dark.addEventListener&&dark.addEventListener('change',palette);

  function size(){
    var w=host.clientWidth, h=host.clientHeight; if(!w||!h) return;
    renderer.setSize(w,h,false); camera.aspect=w/h;
    camera.position.z = w<520 ? 15 : (w/h<1 ? 18.5 : 16.5);
    camera.updateProjectionMatrix();
  }
  size(); addEventListener('resize',size);

  var tx=0,ty=0,px=0,py=0;
  host.closest('.hero').addEventListener('pointermove',function(e){
    var r=host.getBoundingClientRect(); tx=((e.clientX-r.left)/r.width-.5); ty=((e.clientY-r.top)/r.height-.5);
  });

  var running=true;
  if('IntersectionObserver' in window) new IntersectionObserver(function(es){ running=es[0].isIntersecting; if(running&&!reduce) loop(); }).observe(host);
  document.addEventListener('visibilitychange',function(){ if(!document.hidden&&running&&!reduce) loop(); });

  var last=performance.now(), angle=0.6, raf=0;
  function frame(now){
    var dt=Math.min((now-last)/1000,0.05); last=now;
    angle=(angle+dt*0.9)%(Math.PI*2);
    sweep.rotation.z=angle; edge.rotation.z=angle;
    px+=(tx-px)*0.05; py+=(ty-py)*0.05;
    scope.rotation.y=px*0.35; scope.rotation.x=-1.02+py*0.22;
    scope.updateMatrixWorld(true); camera.updateMatrixWorld();   // so label positions match this frame
    var lead=(angle+SPAN)%(Math.PI*2);
    blips.forEach(function(p){
      var d=(lead-p.ang+Math.PI*4)%(Math.PI*2);
      if(d<dt*0.9+0.001) p.glow=1;
      p.glow*=Math.pow(p.tag?0.7:0.35,dt);
      p.mesh.material.opacity=0.25+0.75*p.glow;
      p.mesh.scale.setScalar(1+0.6*p.glow);
      p.ring.material.opacity=0.7*p.glow*p.glow;
      p.ring.scale.setScalar(1+(1-p.glow)*2.2);
      if(p.tag){
        var target=p.glow>0.18?1:0;
        p.vis=(p.vis||0)+(target-(p.vis||0))*(1-Math.pow(0.0025,dt));   // ~0.4s ease in/out
        var a=p.vis*p.vis*(3-2*p.vis);                                   // smoothstep
        p.stem.material.opacity=0.85*a;
        tmpV.copy(p.top); scope.localToWorld(tmpV); tmpV.project(camera);
        var w=host.clientWidth,h=host.clientHeight;
        p.tag.style.opacity=a<0.04?0:a;
        p.tag.style.transform='translate3d('+((tmpV.x+1)/2*w).toFixed(2)+'px,'+((1-tmpV.y)/2*h-6*(1-a)).toFixed(2)+'px,0) translate(-50%,-120%)';
      }
    });
    hub.scale.setScalar(1+0.12*Math.sin(now/400));
    dust.rotation.y+=dt*0.02; dust.rotation.x=Math.sin(now/9000)*0.05;
    renderer.render(scene,camera);
  }
  function loop(){
    cancelAnimationFrame(raf);
    (function tick(now){ if(!running||document.hidden) return; frame(now); raf=requestAnimationFrame(tick); })(performance.now());
  }
  if(reduce){ // one still frame with a few blips lit
    blips.forEach(function(p,i){ p.glow=p.tag?1:(i%3===0?0.8:0); p.vis=p.tag?1:0; });
    frame(performance.now());
  } else loop();
})();
