// Shared: header border on scroll + fade-up reveal as elements scroll into view.
// Content stays visible if this script never runs or the viewer prefers reduced motion.
(function(){
  var root=document.documentElement;
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var head=document.querySelector('.site-head');
  function onScroll(){ if(head) head.classList.toggle('scrolled', window.scrollY>8); }
  addEventListener('scroll',onScroll,{passive:true}); onScroll();
  if(reduce||!('IntersectionObserver' in window)) return;
  // auto-reveal common blocks so every page fades in on scroll
  document.querySelectorAll('.section-head,.feat a,.res,.sheet,.p,section h2,.band').forEach(function(el){ el.classList.add('reveal'); });
  root.classList.add('js');
  var io=new IntersectionObserver(function(es){
    var batch=es.filter(function(e){return e.isIntersecting;});
    batch.forEach(function(e,i){
      e.target.style.transitionDelay=(Math.min(i,5)*90)+'ms';   // stagger items that arrive together
      var el=e.target; el.classList.add('in'); io.unobserve(el);
      // hand control back to the element's own hover styles once the fade ends
      setTimeout(function(){ el.classList.remove('reveal','in'); el.style.transitionDelay=''; }, 1100+Math.min(i,5)*90);
    });
  },{rootMargin:'0px 0px -10% 0px',threshold:0.08});
  document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
})();
