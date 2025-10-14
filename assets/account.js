(function(){
  const ROOT = document.getElementById('account-root');
  if(!ROOT || !window.communityStorage){
    return;
  }

  const storage = window.communityStorage;

  const configAlert = document.getElementById('account-config-alert');
  const createForm = document.getElementById('account-create-form');
  const createErrorEl = document.getElementById('account-create-error');
  const createSuccessEl = document.getElementById('account-create-success');
  const signInForm = document.getElementById('account-signin-form');
  const signInErrorEl = document.getElementById('account-signin-error');
  const signInSuccessEl = document.getElementById('account-signin-success');
  const activeStatusEl = document.getElementById('account-active-status');
  const signOutButton = document.getElementById('account-signout');
  const storageWarningEl = document.getElementById('account-storage-warning');

  let activeAccount = storage.getActiveAccount();

  function showMessage(element, message){
    if(!element){
      return;
    }
    element.hidden = false;
    element.textContent = message;
  }

  function hideMessage(element){
    if(!element){
      return;
    }
    element.hidden = true;
    element.textContent = '';
  }

  function clearFormMessages(){
    [
      createErrorEl,
      createSuccessEl,
      signInErrorEl,
      signInSuccessEl
    ].forEach(hideMessage);
  }

  function normalize(value){
    return String(value || '').trim();
  }

  function normalizeEmail(value){
    return String(value || '').trim().toLowerCase();
  }

  function updateConfigAlert(){
    if(!configAlert){
      return;
    }
    if(storage.isConfigured()){
      configAlert.hidden = false;
      configAlert.classList.remove('account-warning');
      configAlert.classList.add('account-success');
      configAlert.textContent = 'Repository syncing is active. Accounts you create are saved alongside the site.';
    }else{
      configAlert.hidden = false;
      configAlert.classList.remove('account-success');
      configAlert.classList.add('account-warning');
      configAlert.textContent = 'Shared storage is not configured. Ask an administrator to update assets/community-config.js with repository credentials.';
    }
  }

  function updateStorageWarning(){
    if(storageWarningEl){
      storageWarningEl.hidden = storage.hasStorage();
    }
  }

  function updateActiveStatus(customMessage){
    if(activeStatusEl){
      if(customMessage){
        activeStatusEl.textContent = customMessage;
      }else if(activeAccount){
        activeStatusEl.textContent = `Signed in as @${activeAccount.username}.`;
      }else{
        activeStatusEl.textContent = 'Not signed in.';
      }
    }
    if(signOutButton){
      signOutButton.hidden = !activeAccount;
    }
  }

  function setFormDisabled(form, disabled){
    if(!form){
      return;
    }
    const fields = form.querySelectorAll('input, button');
    fields.forEach((field) => {
      field.disabled = disabled;
    });
  }

  async function handleCreate(event){
    event.preventDefault();
    clearFormMessages();

    if(!storage.isConfigured()){
      showMessage(createErrorEl, 'Shared storage is currently unavailable. Contact an administrator for help.');
      return;
    }

    if(!createForm){
      return;
    }

    setFormDisabled(createForm, true);

    try{
      const formData = new FormData(createForm);
      const username = normalize(formData.get('username'));
      const emailRaw = String(formData.get('email') || '').trim();
      const email = normalizeEmail(emailRaw);
      const password = String(formData.get('password') || '');
      const confirm = String(formData.get('confirm') || '');

      if(!username || !emailRaw){
        throw new Error('Username and email are required.');
      }
      if(password.length < 8){
        throw new Error('Use a password with at least eight characters.');
      }
      if(password !== confirm){
        throw new Error('Passwords do not match.');
      }

      const { items: accounts, sha } = await storage.fetchAccounts();
      const usernameLower = username.toLowerCase();
      const emailLower = email;

      if(accounts.some((account) => String(account.username || '').toLowerCase() === usernameLower)){
        throw new Error('That username is already taken.');
      }
      if(accounts.some((account) => String(account.email || '').toLowerCase() === emailLower)){
        throw new Error('That email already has an account.');
      }

      const passwordHash = await storage.hashPassword(password);
      const newAccount = {
        id: storage.createUid('acct'),
        username,
        email,
        passwordHash,
        createdAt: new Date().toISOString()
      };

      const updatedAccounts = Array.isArray(accounts) ? accounts.slice() : [];
      updatedAccounts.push(newAccount);

      await storage.saveAccounts(updatedAccounts, sha, `Add forum account ${username}`);
      activeAccount = { username, email: emailRaw };
      storage.setActiveAccount(activeAccount);

      if(createForm){
        createForm.reset();
      }

      showMessage(createSuccessEl, 'Account created and stored in the repository. You are signed in.');
      updateActiveStatus();
    }catch(err){
      showMessage(createErrorEl, err.message || 'Unable to create the account.');
    }finally{
      setFormDisabled(createForm, false);
    }
  }

  async function handleSignIn(event){
    event.preventDefault();
    clearFormMessages();

    if(!storage.isConfigured()){
      showMessage(signInErrorEl, 'Shared storage is currently unavailable. Contact an administrator for help.');
      return;
    }

    if(!signInForm){
      return;
    }

    setFormDisabled(signInForm, true);

    try{
      const formData = new FormData(signInForm);
      const identifierRaw = normalize(formData.get('identifier'));
      const password = String(formData.get('password') || '');

      if(!identifierRaw || !password){
        throw new Error('Enter your email or username and password.');
      }

      const { items: accounts } = await storage.fetchAccounts();
      if(!Array.isArray(accounts) || accounts.length === 0){
        throw new Error('No accounts exist yet. Create one first.');
      }

      const identifierLower = identifierRaw.toLowerCase();
      const match = accounts.find((account) => {
        const usernameMatch = String(account.username || '').toLowerCase() === identifierLower;
        const emailMatch = String(account.email || '').toLowerCase() === identifierLower;
        return usernameMatch || emailMatch;
      });

      if(!match){
        throw new Error('No account found for that email or username.');
      }

      const hashedInput = await storage.hashPassword(password);
      if(hashedInput !== match.passwordHash){
        throw new Error('Incorrect password.');
      }

      activeAccount = { username: match.username, email: match.email || '' };
      storage.setActiveAccount(activeAccount);

      if(signInForm){
        signInForm.reset();
      }

      showMessage(signInSuccessEl, 'Signed in successfully.');
      updateActiveStatus();
    }catch(err){
      showMessage(signInErrorEl, err.message || 'Unable to sign in.');
    }finally{
      setFormDisabled(signInForm, false);
    }
  }

  function handleSignOut(){
    clearFormMessages();
    storage.clearActiveAccount();
    activeAccount = null;
    updateActiveStatus('Signed out.');
  }

  updateConfigAlert();
  updateStorageWarning();
  updateActiveStatus();

  if(createForm){
    createForm.addEventListener('submit', handleCreate);
  }
  if(signInForm){
    signInForm.addEventListener('submit', handleSignIn);
  }
  if(signOutButton){
    signOutButton.addEventListener('click', handleSignOut);
  }
})();
