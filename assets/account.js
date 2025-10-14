(function(){
  const ROOT = document.getElementById('account-root');
  if(!ROOT){
    return;
  }

  const TOKEN_STORAGE_KEY = 'extynct-auth-token';
  const API_BASE = '/api';

  const createForm = document.getElementById('account-create-form');
  const createErrorEl = document.getElementById('account-create-error');
  const createSuccessEl = document.getElementById('account-create-success');
  const signInForm = document.getElementById('account-signin-form');
  const signInErrorEl = document.getElementById('account-signin-error');
  const signInSuccessEl = document.getElementById('account-signin-success');
  const activeStatusEl = document.getElementById('account-active-status');
  const signOutButton = document.getElementById('account-signout');

  let activeAccount = null;

  function getToken(){
    try{
      return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
    }catch(err){
      console.warn('Unable to read stored session token', err);
      return '';
    }
  }

  function setToken(token){
    try{
      if(token){
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
      }else{
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }catch(err){
      console.warn('Unable to persist session token', err);
    }
  }

  function clearMessages(){
    [createErrorEl, createSuccessEl, signInErrorEl, signInSuccessEl].forEach((el) => {
      if(!el){
        return;
      }
      el.hidden = true;
      el.textContent = '';
    });
  }

  function showMessage(target, message){
    if(!target){
      return;
    }
    target.hidden = false;
    target.textContent = message;
  }

  function updateActiveStatus(message){
    if(activeStatusEl){
      if(message){
        activeStatusEl.textContent = message;
      }else if(activeAccount){
        activeStatusEl.textContent = `Signed in as @${activeAccount.username}`;
      }else{
        activeStatusEl.textContent = 'Not signed in.';
      }
    }
    if(signOutButton){
      signOutButton.hidden = !activeAccount;
    }
  }

  async function requestJson(path, options){
    const opts = Object.assign({
      headers: {
        'Accept': 'application/json'
      }
    }, options || {});

    opts.headers = Object.assign({ 'Accept': 'application/json' }, opts.headers || {});

    const token = getToken();
    if(token){
      opts.headers['Authorization'] = `Bearer ${token}`;
    }

    if(opts.body && !(opts.body instanceof FormData) && !opts.headers['Content-Type']){
      opts.headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE}${path}`, opts);
    const isJson = response.headers.get('content-type') && response.headers.get('content-type').includes('application/json');
    const payload = isJson ? await response.json().catch(() => null) : null;
    if(!response.ok){
      const errorMessage = payload && payload.message ? payload.message : `Request failed with status ${response.status}`;
      throw new Error(errorMessage);
    }
    return payload;
  }

  async function refreshSession(){
    const token = getToken();
    if(!token){
      activeAccount = null;
      updateActiveStatus();
      return;
    }

    try{
      const result = await requestJson('/auth/session', { method: 'GET' });
      activeAccount = result && result.account ? result.account : null;
    }catch(err){
      console.warn('Session refresh failed', err);
      activeAccount = null;
      setToken('');
    }
    updateActiveStatus();
  }

  async function handleCreate(event){
    event.preventDefault();
    clearMessages();

    if(!createForm){
      return;
    }

    const formData = new FormData(createForm);
    const username = formData.get('username');
    const email = formData.get('email');
    const password = formData.get('password');
    const confirm = formData.get('confirm');

    if(password !== confirm){
      showMessage(createErrorEl, 'Passwords do not match.');
      return;
    }

    try{
      const payload = {
        username: username && String(username).trim(),
        email: email && String(email).trim(),
        password: password && String(password)
      };

      const result = await requestJson('/accounts', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if(result && result.token){
        setToken(result.token);
      }
      activeAccount = result && result.account ? result.account : null;
      showMessage(createSuccessEl, 'Account created and signed in.');
      createForm.reset();
      updateActiveStatus();
    }catch(err){
      showMessage(createErrorEl, err.message || 'Unable to create account.');
    }
  }

  async function handleSignIn(event){
    event.preventDefault();
    clearMessages();

    if(!signInForm){
      return;
    }

    const formData = new FormData(signInForm);
    const identifier = formData.get('identifier');
    const password = formData.get('password');

    try{
      const result = await requestJson('/auth/signin', {
        method: 'POST',
        body: JSON.stringify({
          identifier: identifier && String(identifier).trim(),
          password: password && String(password)
        })
      });

      if(result && result.token){
        setToken(result.token);
      }
      activeAccount = result && result.account ? result.account : null;
      showMessage(signInSuccessEl, 'Signed in successfully.');
      signInForm.reset();
      updateActiveStatus();
    }catch(err){
      showMessage(signInErrorEl, err.message || 'Unable to sign in.');
    }
  }

  async function handleSignOut(){
    clearMessages();
    const token = getToken();
    if(!token){
      activeAccount = null;
      setToken('');
      updateActiveStatus('Not signed in.');
      return;
    }

    try{
      await requestJson('/auth/signout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ token })
      });
    }catch(err){
      console.warn('Sign-out failed', err);
    }

    activeAccount = null;
    setToken('');
    updateActiveStatus('Signed out.');
  }

  if(createForm){
    createForm.addEventListener('submit', handleCreate);
  }
  if(signInForm){
    signInForm.addEventListener('submit', handleSignIn);
  }
  if(signOutButton){
    signOutButton.addEventListener('click', handleSignOut);
  }

  refreshSession();
})();
