<script>
/* Shared helpers: theme toggle, tiny DOM util */
(function(){
  function setTheme(t){
    const r=document.documentElement;
    if(t==='dark') r.classList.add('dark'); else r.classList.remove('dark');
    try{ localStorage.setItem('eps-theme', t); }catch(e){}
  }
  const saved = (typeof localStorage!=='undefined' && localStorage.getItem('eps-theme')) || 'dark';
  setTheme(saved);
  window.EPS_toggleTheme = function(){
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    setTheme(next);
  };
  window.$ = (sel,root=document)=>root.querySelector(sel);
  window.$$ = (sel,root=document)=>Array.from(root.querySelectorAll(sel));
})();
</script>