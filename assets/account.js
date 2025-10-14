(function(){
  const ROOT = document.getElementById('account-root');
  if(!ROOT || !window.repoStorage){
    return;
  }

  const client = repoStorage.createClient(ROOT);

  const githubForm = document.getElementById('account-github-form');
  const ownerInput = document.getElementById('account-github-owner');
  const repoInput = document.getElementById('account-github-repo');
  const branchInput = document.getElementById('account-github-branch');
  const tokenInput = document.getElementById('account-github-token');
  const githubErrorEl = document.getElementById('account-github-error');
  const githubSuccessEl = document.getElementById('account-github-success');
  const githubTokenStatus = document.getElementById('account-github-token-status');
  const githubClearToken = document.getElementById('account-github-clear-token');

  const createForm = document.getElementById('account-create-form');
  const createErrorEl = document.getElementById('account-create-error');
  const createSuccessEl = document.getElementById('account-create-success');

  const signInForm = document.getElementById('account-signin-form');
  const signInErrorEl = document.getElementById('account-signin-error');
  const signInSuccessEl = document.getElementById('account-signin-success');
  const storageWarningEl = document.getElementById('account-storage-warning');

  const activeStatusEl = document.getElementById('account-active-status');
  const signOutButton = document.getElementById('account-signout');

  let activeAccount = client.getActiveAccount();

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
    [githubErrorEl, githubSuccessEl, createErrorEl, createSuccessEl, signInErrorEl, signInSuccessEl].forEach(hideMessage);
  }

  function updateActiveStatus(customMessage){
    if(activeStatusEl){
      if(customMessage){
        activeStatusEl.textContent = customMessage;
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

  function updateStorageWarning(show){
    if(storageWarningEl){
      storageWarningEl.hidden = !show;
    }
  }

  function updateTokenStatus(){
    if(!githubTokenStatus){
      return;
    }
    if(!client.hasStorage()){
      githubTokenStatus.textContent = 'Local storage is disabled, so tokens and settings will reset after closing this tab.';
      return;
    }
    githubTokenStatus.textContent = client.hasToken()
      ? 'A personal access token is saved in this browser.'
      : 'No token saved yet. Provide one to enable saving to the repository.';
  }

  function populateGithubForm(){
    if(!githubForm){
      return;
    }
    const config = client.getConfig();
    if(ownerInput){
      ownerInput.value = config.owner || '';
    }
    if(repoInput){
      repoInput.value = config.repo || '';
    }
    if(branchInput){
      branchInput.value = config.branch || 'main';
    }
    if(tokenInput){
      tokenInput.value = '';
    }
    updateTokenStatus();
  }

  function normalizeUsername(value){
    return String(value || '').trim();
  }

  function normalizeEmail(value){
    return String(value || '').trim().toLowerCase();
  }

  function normalizeIdentifier(value){
    return String(value || '').trim();
  }

  function resetAccountForms(){
    if(createForm){
      createForm.reset();
    }
    if(signInForm){
      signInForm.reset();
    }
  }

  async function handleGithubSubmit(event){
    event.preventDefault();
    clearFormMessages();

    if(!githubForm){
      return;
    }

    const owner = normalizeUsername(ownerInput && ownerInput.value);
    const repo = normalizeUsername(repoInput && repoInput.value);
    const branch = normalizeUsername(branchInput && branchInput.value) || 'main';
    const token = tokenInput ? tokenInput.value.trim() : '';

    if(!owner || !repo){
      showMessage(githubErrorEl, 'Repository owner and name are required.');
      return;
    }

    client.setConfig({ owner, repo, branch });

    let tokenPersisted = true;
    if(token){
      tokenPersisted = client.setToken(token);
      if(!tokenPersisted){
        showMessage(githubErrorEl, 'Unable to store the token. Check your browser privacy settings.');
        updateTokenStatus();
        return;
      }
    }

    populateGithubForm();

    const note = !client.hasStorage()
      ? 'Settings saved for this session. They will reset once the tab closes because local storage is unavailable.'
      : token ? 'Settings and token saved. You can now create accounts and posts.' : 'Repository settings saved.';
    showMessage(githubSuccessEl, note);
  }

  function handleClearToken(){
    clearFormMessages();
    if(!client.clearToken()){
      showMessage(githubErrorEl, 'Unable to remove the saved token.');
    }else{
      showMessage(githubSuccessEl, 'Token removed from this browser.');
    }
    updateTokenStatus();
    if(tokenInput){
      tokenInput.value = '';
    }
  }

  async function handleCreate(event){
    event.preventDefault();
    clearFormMessages();

    if(!createForm){
      return;
    }

    const formData = new FormData(createForm);
    const username = normalizeUsername(formData.get('username'));
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

    const config = client.getConfig();
    if(!config.owner || !config.repo){
      showMessage(createErrorEl, 'Connect to GitHub first so the account can be saved.');
      return;
    }

    let passwordHash;
    try{
      passwordHash = await repoStorage.hashPassword(password);
    }catch(err){
      showMessage(createErrorEl, 'Unable to hash the password in this browser.');
      return;
    }

    const newAccount = {
      id: repoStorage.createUid('acct'),
      username,
      email,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    try{
      await client.updateJson('data/accounts.json', (data) => {
        const accounts = Array.isArray(data) ? data.slice() : [];
        const lowerUsername = username.toLowerCase();
        const lowerEmail = email;
        if(accounts.some((account) => String(account.username || '').toLowerCase() === lowerUsername)){
          throw new Error('That username is already taken.');
        }
        if(accounts.some((account) => String(account.email || '').toLowerCase() === lowerEmail)){
          throw new Error('That email already has an account.');
        }
        accounts.push(newAccount);
        return accounts;
      }, `Add account ${username}`, []);
    }catch(err){
      showMessage(createErrorEl, err.message || 'Unable to save the account to GitHub.');
      return;
    }

    activeAccount = { username, email: emailRaw };
    const stored = client.setActiveAccount(activeAccount);
    updateStorageWarning(!stored || !client.hasStorage());
    showMessage(createSuccessEl, 'Account created and saved to the repository.');
    resetAccountForms();
    updateActiveStatus();
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

    const config = client.getConfig();
    if(!config.owner || !config.repo){
      showMessage(signInErrorEl, 'Connect to GitHub before signing in.');
      return;
    }

    let accounts = [];
    try{
      accounts = await client.fetchJson('data/accounts.json', []);
    }catch(err){
      showMessage(signInErrorEl, 'Unable to load accounts from the repository.');
      return;
    }

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
      hashedInput = await repoStorage.hashPassword(password);
    }catch(err){
      showMessage(signInErrorEl, 'Unable to process the password in this browser.');
      return;
    }

    if(hashedInput !== match.passwordHash){
      showMessage(signInErrorEl, 'Incorrect password.');
      return;
    }

    activeAccount = { username: match.username, email: match.email || '' };
    const stored = client.setActiveAccount(activeAccount);
    updateStorageWarning(!stored || !client.hasStorage());
    showMessage(signInSuccessEl, 'Signed in successfully.');
    signInForm.reset();
    updateActiveStatus();
  }

  function handleSignOut(){
    clearFormMessages();
    activeAccount = null;
    const cleared = client.clearActiveAccount();
    updateStorageWarning(!cleared || !client.hasStorage());
    updateActiveStatus('Signed out.');
  }

  if(githubForm){
    githubForm.addEventListener('submit', handleGithubSubmit);
  }
  if(githubClearToken){
    githubClearToken.addEventListener('click', handleClearToken);
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

  populateGithubForm();
  updateActiveStatus();
  updateStorageWarning(!client.hasStorage() && !activeAccount);
})();
