document.querySelectorAll('[data-year]').forEach(el=>{el.textContent=new Date().getFullYear();});
const navigation=[...document.querySelectorAll('.site-header nav a')];
const sections=navigation.map(a=>a.getAttribute('href')).filter(h=>h.startsWith('#')).map(h=>document.querySelector(h)).filter(Boolean);
if(sections.length) {
  const updateNavigation=()=>{
    const current=sections.reduce((last,section)=>section.getBoundingClientRect().top<window.innerHeight*.4?section:last,sections[0]);
    navigation.forEach(a=>{if(a.hash===`#${current.id}`) a.setAttribute('aria-current','location'); else a.removeAttribute('aria-current');});
  };
  let queued=false;
  window.addEventListener('scroll',()=>{if(!queued){queued=true;requestAnimationFrame(()=>{updateNavigation();queued=false;});}},{passive:true});
  updateNavigation();
}
