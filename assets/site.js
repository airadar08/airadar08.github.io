// Shared: header border on scroll + gentle reveal of sections. Content stays visible if this never runs.
(function(){
  var root=document.documentElement;
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var head=document.querySelector('.site-head');
  function onScroll(){ if(head) head.classList.toggle('scrolled', window.scrollY>8); }
  addEventListener('scroll',onScroll,{passive:true}); onScroll();
  if(reduce||!('IntersectionObserver' in window)) return;
  root.classList.add('js');
  var io=new IntersectionObserver(function(es){es.forEach(function(e){ if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);} });},{rootMargin:'0px 0px -8% 0px'});
  document.querySelectorAll('.reveal').forEach(function(el,i){
    var r=el.getBoundingClientRect();
    if(r.top<innerHeight){ el.style.transitionDelay=(Math.min(i,6)*70)+'ms'; requestAnimationFrame(function(){el.classList.add('in');}); }
    else io.observe(el);
  });
})();
