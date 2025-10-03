(function () {
  if (typeof window === 'undefined') {
    return;
  }

  const currentScript = document.currentScript;
  const dataEndpoint = currentScript && currentScript.dataset
    ? currentScript.dataset.authEndpoint
    : undefined;

  const AUTH_ENDPOINT = dataEndpoint || window.AUTH_ENDPOINT || '/api/login';

  async function submitLogin(event) {
    event.preventDefault();

    const form = event.target;
    const formData = new FormData(form);
    const username = formData.get('username');
    const password = formData.get('password');

    const status = form.querySelector('[data-login-status]');
    if (status) {
      status.textContent = 'Signing in…';
    }

    try {
      const response = await fetch(AUTH_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload && payload.message ? payload.message : 'Login failed');
      }

      if (status) {
        status.textContent = 'Success! Redirecting…';
      }

      if (payload.redirectUrl) {
        window.location.href = payload.redirectUrl;
      }
    } catch (error) {
      if (status) {
        status.textContent = error.message;
      } else {
        console.error(error);
      }
    }
  }

  const form = document.querySelector('[data-login-form]');
  if (form) {
    form.addEventListener('submit', submitLogin);
  }

  window.EPSLogin = {
    submitLogin,
    AUTH_ENDPOINT,
  };
})();
