(function(){
  function guessRepository(){
    try{
      const { hostname, pathname } = window.location;
      if(/github\.io$/i.test(hostname)){
        const hostParts = hostname.split('.');
        const owner = hostParts[0] || '';
        const pathParts = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
        const repo = pathParts.length > 0 ? pathParts[0] : owner;
        return { owner, repo };
      }
    }catch(err){
      // ignore
    }
    return { owner: '', repo: '' };
  }

  const guesses = guessRepository();

  window.communityConfig = Object.assign(
    {
      owner: guesses.owner || 'ExtynctStudios',
      repo: guesses.repo || 'ExtynctStudios',
      branch: 'main',
      token: '',
      dataDir: 'hidden/community',
      mediaDir: 'uploads/community'
    },
    window.communityConfig || {}
  );
})();
