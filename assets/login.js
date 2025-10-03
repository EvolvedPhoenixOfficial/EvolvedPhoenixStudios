(function(){
  const AUTH_ENDPOINT = 'https://auth.evolvedphoenixstudios.com/api/login';
  const STORAGE_KEY = 'eps-auth-token';

  function setFeedback(message, variant){
    const feedbackEl = document.getElementById('login-feedback');
    if(!feedbackEl){
      return;
    }
    feedbackEl.textContent = message;
    feedbackEl.style.color = variant === 'error' ? '#dc2626' : '#16a34a';
  }

  async function requestLogin(username, password){
    const response = await fetch(AUTH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ username, password })
    });

    if(!response.ok){
      const errorText = await response.text().catch(() => '');
      const detail = errorText ? `: ${errorText}` : '';
      throw new Error(`Login failed${detail}`);
    }

    return response.json();
  }

  function persistToken(token){
    try {
      sessionStorage.setItem(STORAGE_KEY, token);
    } catch (err) {
      console.warn('Unable to persist login token in session storage', err);
    }
  }

  function handleSuccess(payload){
    if(payload && payload.token){
      persistToken(payload.token);
      setFeedback('Signed in successfully. Redirecting…', 'success');
      const redirect = payload.redirectUrl || '/';
      setTimeout(() => {
        window.location.href = redirect;
      }, 800);
    } else {
      setFeedback('Signed in, but no session token was returned.', 'error');
    }
  }

  function setLoading(loading){
    const submitBtn = document.getElementById('login-submit');
    if(submitBtn){
      submitBtn.disabled = loading;
      submitBtn.textContent = loading ? 'Signing in…' : 'Sign in';
    }
  }

  function onSubmit(event){
    event.preventDefault();
    const form = event.currentTarget;
    const username = form.username.value.trim();
    const password = form.password.value;

    if(!username || !password){
      setFeedback('Enter both a username and password to continue.', 'error');
      return;
    }

    setLoading(true);
    setFeedback('Contacting secure server…', 'success');

    requestLogin(username, password)
      .then(handleSuccess)
      .catch((error) => {
        console.error(error);
        setFeedback(error.message || 'Unable to sign in. Try again in a moment.', 'error');
      })
      .finally(() => setLoading(false));
  }

  function init(){
    const form = document.getElementById('login-form');
    if(!form){
      return;
    }

    form.addEventListener('submit', onSubmit);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
