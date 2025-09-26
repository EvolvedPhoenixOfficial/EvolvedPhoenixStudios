(function(){
  const THEME_KEY = 'eps-theme';

  function persistTheme(theme){
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch (err) {
      // ignore storage issues (private mode, etc.)
    }
  }

  function setTheme(theme){
    document.documentElement.classList.toggle('dark', theme === 'dark');
    persistTheme(theme);
  }

  function getStoredTheme(){
    try {
      return localStorage.getItem(THEME_KEY);
    } catch (err) {
      return null;
    }
  }

  function getTheme(){
    return getStoredTheme() || 'dark';
  }

  function updateYear(){
    const yearEl = document.getElementById('year');
    if(yearEl){
      yearEl.textContent = new Date().getFullYear();
    }
  }

  function loadIncludes(){
    const includeElements = document.querySelectorAll('[data-include]');
    includeElements.forEach((el) => {
      const src = el.getAttribute('data-include');
      if(!src) return;
      fetch(src)
        .then((response) => {
          if(!response.ok){
            throw new Error(`Failed to load include: ${src} (${response.status})`);
          }
          return response.text();
        })
        .then((html) => {
          el.innerHTML = html;
          el.removeAttribute('data-include');
          updateYear();
        })
        .catch((error) => {
          console.error(error);
        });
    });
  }

  window.toggleTheme = function(){
    const next = document.documentElement.classList.contains('dark') ? 'light' : 'dark';
    setTheme(next);
  };

  setTheme(getTheme());

  function init(){
    loadIncludes();
    updateYear();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
