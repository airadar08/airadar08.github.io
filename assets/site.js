// Shared: header border on scroll + fade in/out as elements enter or leave the screen, scrolling either way.
// Content stays visible if this script never runs or the viewer prefers reduced motion.
(function(){
  var root=document.documentElement;
  var reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  var head=document.querySelector('.site-head');
  function onScroll(){ if(head) head.classList.toggle('scrolled', window.scrollY>8); }
  addEventListener('scroll',onScroll,{passive:true}); onScroll();
  if(reduce||!('IntersectionObserver' in window)) return;
  document.querySelectorAll('.section-head,.feat a,.res,.sheet,.p,section h2,.band').forEach(function(el){ el.classList.add('reveal'); });
  root.classList.add('js');
  var io=new IntersectionObserver(function(es){
    var n=0;
    es.forEach(function(e){
      var el=e.target;
      if(e.isIntersecting){
        el.style.transitionDelay=(Math.min(n++,5)*80)+'ms';   // stagger items that arrive together
        el.classList.remove('above'); el.classList.add('in');
      }else{
        el.style.transitionDelay='0ms';
        el.classList.remove('in');
        el.classList.toggle('above', e.boundingClientRect.top<0);  // left through the top: come back from above
      }
    });
  },{rootMargin:'-6% 0px -6% 0px',threshold:0.06});
  document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });
})();
