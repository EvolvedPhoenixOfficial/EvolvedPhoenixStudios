(function(){
  const ROOT = document.getElementById('account-root');
  if(!ROOT){
    return;
  }

  const ACCOUNT_STORAGE_KEY = 'extynct-accounts';
  const LEGACY_ACCOUNT_STORAGE_KEY = 'extynct-forum-accounts';
  const ACTIVE_ACCOUNT_KEY = 'extynct-active-account';

  const createForm = document.getElementById('account-create-form');
  const createErrorEl = document.getElementById('account-create-error');
  const createSuccessEl = document.getElementById('account-create-success');
  const signInForm = document.getElementById('account-signin-form');
  const signInErrorEl = document.getElementById('account-signin-error');
  const signInSuccessEl = document.getElementById('account-signin-success');
  const activeStatusEl = document.getElementById('account-active-status');
  const signOutButton = document.getElementById('account-signout');

  let storageAvailable = true;
  let accounts = [];
  let activeAccountId = null;

  function safeCall(fn){
    if(!storageAvailable){
      return null;
    }
    try{
      return fn();
    }catch(err){
      console.warn('Account storage unavailable:', err);
      storageAvailable = false;
      return null;
    }
  }

  function clearLegacyStorage(){
    safeCall(() => localStorage.removeItem(LEGACY_ACCOUNT_STORAGE_KEY));
  }

  function readAccounts(){
    const raw = safeCall(() => localStorage.getItem(ACCOUNT_STORAGE_KEY));
    if(!raw){
      return [];
    }

    try{
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed)){
        return parsed;
      }
    }catch(err){
      console.warn('Failed to parse saved accounts', err);
    }
    return [];
  }

  function saveAccounts(list){
    if(!Array.isArray(list)){
      return;
    }
    safeCall(() => localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(list)));
  }

  function readActiveAccountId(){
    return safeCall(() => localStorage.getItem(ACTIVE_ACCOUNT_KEY));
  }

  function saveActiveAccountId(id){
    if(id){
      safeCall(() => localStorage.setItem(ACTIVE_ACCOUNT_KEY, id));
    }else{
      safeCall(() => localStorage.removeItem(ACTIVE_ACCOUNT_KEY));
    }
  }

  async function hashPassword(password){
    if(typeof password !== 'string'){
      return '';
    }

    if(typeof crypto !== 'undefined' && crypto.subtle && typeof TextEncoder !== 'undefined'){
      const encoder = new TextEncoder();
      const data = encoder.encode(password);
      const digest = await crypto.subtle.digest('SHA-256', data);
      const bytes = Array.from(new Uint8Array(digest));
      return bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
    }

    try{
      return btoa(unescape(encodeURIComponent(password)));
    }catch(err){
      return password;
    }
  }

  function clearCreateMessages(){
    if(createErrorEl){
      createErrorEl.hidden = true;
      createErrorEl.textContent = '';
    }
    if(createSuccessEl){
      createSuccessEl.hidden = true;
      createSuccessEl.textContent = '';
    }
  }

  function clearSignInMessages(){
    if(signInErrorEl){
      signInErrorEl.hidden = true;
      signInErrorEl.textContent = '';
    }
    if(signInSuccessEl){
      signInSuccessEl.hidden = true;
      signInSuccessEl.textContent = '';
    }
  }

  function showCreateError(message){
    if(createErrorEl){
      createErrorEl.textContent = message;
      createErrorEl.hidden = false;
    }
    if(createSuccessEl){
      createSuccessEl.hidden = true;
      createSuccessEl.textContent = '';
    }
  }

  function showCreateSuccess(message){
    if(createSuccessEl){
      createSuccessEl.textContent = message;
      createSuccessEl.hidden = false;
    }
    if(createErrorEl){
      createErrorEl.hidden = true;
      createErrorEl.textContent = '';
    }
  }

  function showSignInError(message){
    if(signInErrorEl){
      signInErrorEl.textContent = message;
      signInErrorEl.hidden = false;
    }
    if(signInSuccessEl){
      signInSuccessEl.hidden = true;
      signInSuccessEl.textContent = '';
    }
  }

  function showSignInSuccess(message){
    if(signInSuccessEl){
      signInSuccessEl.textContent = message;
      signInSuccessEl.hidden = false;
    }
    if(signInErrorEl){
      signInErrorEl.hidden = true;
      signInErrorEl.textContent = '';
    }
  }

  function createId(prefix = 'acct'){
    if(typeof crypto !== 'undefined' && crypto.randomUUID){
      const uuid = crypto.randomUUID();
      return prefix ? `${prefix}-${uuid}` : uuid;
    }
    const fallback = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return prefix ? `${prefix}-${fallback}` : fallback;
  }

  function getActiveAccount(){
    if(!activeAccountId){
      return null;
    }
    return accounts.find((acct) => acct && acct.id === activeAccountId) || null;
  }

  function updateActiveStatus(message){
    const activeAccount = getActiveAccount();
    if(activeStatusEl){
      if(activeAccount){
        activeStatusEl.textContent = message || `Signed in as @${activeAccount.username}`;
      }else{
        activeStatusEl.textContent = message || 'Not signed in.';
      }
    }
    if(signOutButton){
      signOutButton.hidden = !activeAccount;
    }
  }

  function setActiveAccount(id, message){
    activeAccountId = id || null;
    saveActiveAccountId(activeAccountId);
    updateActiveStatus(message);
  }

  function ensureStorage(){
    if(storageAvailable){
      return true;
    }
    showCreateError('Local storage is disabled, so accounts cannot be saved on this device.');
    showSignInError('Local storage is disabled, so sign-in is unavailable.');
    return false;
  }

  clearLegacyStorage();
  accounts = readAccounts();
  activeAccountId = readActiveAccountId();
  updateActiveStatus();

  if(createForm){
    createForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearCreateMessages();

      if(!ensureStorage()){
        return;
      }

      const formData = new FormData(createForm);
      const usernameRaw = (formData.get('username') || '').toString().trim();
      const emailRaw = (formData.get('email') || '').toString().trim();
      const password = (formData.get('password') || '').toString();
      const confirm = (formData.get('confirm') || '').toString();

      if(!usernameRaw){
        showCreateError('Please choose a username.');
        return;
      }
      if(!emailRaw){
        showCreateError('Please add an email.');
        return;
      }
      if(password.length < 8){
        showCreateError('Passwords must be at least 8 characters long.');
        return;
      }
      if(password !== confirm){
        showCreateError('Passwords do not match.');
        return;
      }

      const usernamePattern = /^[a-zA-Z0-9_\-]{3,32}$/;
      if(!usernamePattern.test(usernameRaw)){
        showCreateError('Usernames must be 3-32 characters and can use letters, numbers, underscores, or hyphens.');
        return;
      }

      const normalizedEmail = emailRaw.toLowerCase();
      const normalizedUsername = usernameRaw.toLowerCase();

      if(accounts.some((acct) => acct.username && acct.username.toLowerCase() === normalizedUsername)){
        showCreateError('That username is already in use on this device.');
        return;
      }

      if(accounts.some((acct) => acct.email === normalizedEmail)){
        showCreateError('That email is already linked to an account on this device.');
        return;
      }

      try{
        const passwordHash = await hashPassword(password);
        const account = {
          id: createId('acct'),
          username: usernameRaw,
          email: normalizedEmail,
          passwordHash,
          createdAt: new Date().toISOString()
        };

        accounts.push(account);
        saveAccounts(accounts);

        if(!storageAvailable){
          accounts.pop();
          showCreateError('Local storage is disabled, so accounts cannot be saved on this device.');
          return;
        }

        createForm.reset();
        showCreateSuccess(`Account @${account.username} created. You're signed in!`);
        setActiveAccount(account.id);
      }catch(err){
        console.error('Failed to create account', err);
        showCreateError('Something went wrong while saving your account. Please try again.');
      }
    });
  }

  if(signInForm){
    signInForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearSignInMessages();

      if(!ensureStorage()){
        return;
      }

      const formData = new FormData(signInForm);
      const identifierRaw = (formData.get('identifier') || '').toString().trim();
      const password = (formData.get('password') || '').toString();

      if(!identifierRaw){
        showSignInError('Enter the email or username connected to your account.');
        return;
      }
      if(password.length === 0){
        showSignInError('Enter your password to sign in.');
        return;
      }

      const normalizedIdentifier = identifierRaw.toLowerCase();
      const match = accounts.find((acct) => {
        if(!acct){
          return false;
        }
        return acct.email === normalizedIdentifier || (acct.username && acct.username.toLowerCase() === normalizedIdentifier);
      });

      if(!match){
        showSignInError('We could not find an account with that email or username.');
        return;
      }

      try{
        const passwordHash = await hashPassword(password);
        if(match.passwordHash !== passwordHash){
          showSignInError('Incorrect password.');
          return;
        }

        setActiveAccount(match.id, `Signed in as @${match.username}.`);
        showSignInSuccess(`Welcome back, @${match.username}!`);
        signInForm.reset();
      }catch(err){
        console.error('Failed to sign in', err);
        showSignInError('Something went wrong while signing you in. Please try again.');
      }
    });
  }

  if(signOutButton){
    signOutButton.addEventListener('click', () => {
      clearSignInMessages();
      setActiveAccount(null, 'Signed out.');
      showSignInSuccess('Signed out.');
    });
  }
})();
