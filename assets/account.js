(function(){
  const ROOT = document.getElementById('account-root');
  if(!ROOT || !window.communityStorage){
    return;
  }

  const storage = window.communityStorage;

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
    [createErrorEl, createSuccessEl, signInErrorEl, signInSuccessEl].forEach(hideMessage);
  }

  function normalize(value){
    return String(value || '').trim();
  }

  function normalizeIdentifier(value){
    return String(value || '').trim();
  }

  function normalizeEmail(value){
    return String(value || '').trim().toLowerCase();
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

  function updateStorageWarning(forceShow){
    if(!storageWarningEl){
      return;
    }
    const shouldShow = Boolean(forceShow) || !storage.hasStorage();
    storageWarningEl.hidden = !shouldShow;
  }

  function resetForms(){
    if(createForm){
      createForm.reset();
    }
    if(signInForm){
      signInForm.reset();
    }
  }

  async function handleCreate(event){
    event.preventDefault();
    clearFormMessages();

    if(!createForm){
      return;
    }

    const formData = new FormData(createForm);
    const username = normalize(formData.get('username'));
    const emailRaw = String(formData.get('email') || '').trim();
    const email = normalizeEmail(emailRaw);
    const password = String(formData.get('password') || '');
    const confirm = String(formData.get('confirm') || '');

    if(!username || !emailRaw){
      showMessage(createErrorEl, 'Username and email are required.');
      return;
    }

    if(password.length < 8){
      showMessage(createErrorEl, 'Use a password with at least eight characters.');
      return;
    }

    if(password !== confirm){
      showMessage(createErrorEl, 'Passwords do not match.');
      return;
    }

    let accounts = storage.getAccounts();
    const usernameLower = username.toLowerCase();
    const emailLower = email;

    if(accounts.some((account) => String(account.username || '').toLowerCase() === usernameLower)){
      showMessage(createErrorEl, 'That username is already taken.');
      return;
    }

    if(accounts.some((account) => String(account.email || '').toLowerCase() === emailLower)){
      showMessage(createErrorEl, 'That email already has an account.');
      return;
    }

    let passwordHash;
    try{
      passwordHash = await storage.hashPassword(password);
    }catch(err){
      showMessage(createErrorEl, 'Unable to process the password in this browser.');
      return;
    }

    const newAccount = {
      id: storage.createUid('acct'),
      username,
      email,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    accounts.push(newAccount);
    const accountsStored = storage.saveAccounts(accounts);

    activeAccount = { username, email: emailRaw };
    const sessionStored = storage.setActiveAccount(activeAccount);

    const persistent = accountsStored && sessionStored && storage.hasStorage();

    showMessage(createSuccessEl, persistent ? 'Account created and saved to this browser.' : 'Account created for this session. Enable local storage to keep it after you close the tab.');

    resetForms();
    updateActiveStatus();
    updateStorageWarning(!(accountsStored && sessionStored));
  }

  async function handleSignIn(event){
    event.preventDefault();
    clearFormMessages();

    if(!signInForm){
      return;
    }

    const formData = new FormData(signInForm);
    const identifierRaw = normalizeIdentifier(formData.get('identifier'));
    const password = String(formData.get('password') || '');

    if(!identifierRaw || !password){
      showMessage(signInErrorEl, 'Enter your email or username and password.');
      return;
    }

    const accounts = storage.getAccounts();
    if(!Array.isArray(accounts) || accounts.length === 0){
      showMessage(signInErrorEl, 'No accounts exist yet. Create one first.');
      return;
    }

    const identifierLower = identifierRaw.toLowerCase();
    const match = accounts.find((account) => {
      const usernameMatch = String(account.username || '').toLowerCase() === identifierLower;
      const emailMatch = String(account.email || '').toLowerCase() === identifierLower;
      return usernameMatch || emailMatch;
    });

    if(!match){
      showMessage(signInErrorEl, 'No account found for that email or username.');
      return;
    }

    let hashedInput;
    try{
      hashedInput = await storage.hashPassword(password);
    }catch(err){
      showMessage(signInErrorEl, 'Unable to process the password in this browser.');
      return;
    }

    if(hashedInput !== match.passwordHash){
      showMessage(signInErrorEl, 'Incorrect password.');
      return;
    }

    activeAccount = { username: match.username, email: match.email || '' };
    const sessionStored = storage.setActiveAccount(activeAccount);
    showMessage(signInSuccessEl, sessionStored && storage.hasStorage() ? 'Signed in successfully.' : 'Signed in for this session. Enable local storage to stay signed in.');

    signInForm.reset();
    updateActiveStatus();
    updateStorageWarning(!sessionStored);
  }

  function handleSignOut(){
    clearFormMessages();
    storage.clearActiveAccount();
    activeAccount = null;
    updateActiveStatus('Signed out.');
    updateStorageWarning(!storage.hasStorage());
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

  updateActiveStatus();
  updateStorageWarning(!storage.hasStorage() && !activeAccount);
})();
