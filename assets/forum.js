(function(){
  const ROOT = document.getElementById('forum-root');
  if(!ROOT){
    return;
  }

  const STORAGE_KEY = 'extynct-forum-posts';
  const ACCOUNT_STORAGE_KEY = 'extynct-forum-accounts';
  const ACTIVE_ACCOUNT_KEY = 'extynct-active-account';
  const form = document.getElementById('forum-form');
  const postsContainer = document.getElementById('forum-posts');
  const emptyState = document.getElementById('forum-empty');
  const errorEl = document.getElementById('forum-form-error');
  const storageWarning = document.getElementById('forum-storage-warning');
  const resetButton = document.getElementById('forum-reset');
  const accountForm = document.getElementById('forum-account-form');
  const accountErrorEl = document.getElementById('forum-account-error');
  const accountSuccessEl = document.getElementById('forum-account-success');
  const accountStatusEl = document.getElementById('forum-account-status');
  const accountPickerWrapper = document.querySelector('.forum-account-select');
  const accountPicker = document.getElementById('forum-account-picker');
  const accountSignOut = document.getElementById('forum-account-signout');
  const authorInput = document.getElementById('forum-author');

  if(!form || !postsContainer || !emptyState || !resetButton){
    return;
  }

  let storageAvailable = true;

  function safeCall(fn){
    if(!storageAvailable){
      return null;
    }

    try{
      return fn();
    }catch(err){
      console.warn('Forum storage unavailable:', err);
      storageAvailable = false;
      if(storageWarning){
        storageWarning.hidden = false;
      }
      return null;
    }
  }

  function clearAccountAlerts(){
    if(accountErrorEl){
      accountErrorEl.hidden = true;
      accountErrorEl.textContent = '';
    }
    if(accountSuccessEl){
      accountSuccessEl.hidden = true;
      accountSuccessEl.textContent = '';
    }
  }

  function showAccountError(message){
    if(!accountErrorEl){
      return;
    }
    accountErrorEl.textContent = message;
    accountErrorEl.hidden = false;
    if(accountSuccessEl){
      accountSuccessEl.hidden = true;
      accountSuccessEl.textContent = '';
    }
  }

  function showAccountSuccess(message){
    if(!accountSuccessEl){
      return;
    }
    accountSuccessEl.textContent = message;
    accountSuccessEl.hidden = false;
    if(accountErrorEl){
      accountErrorEl.hidden = true;
      accountErrorEl.textContent = '';
    }
  }

  function readStoredAccounts(){
    const value = safeCall(() => localStorage.getItem(ACCOUNT_STORAGE_KEY));
    if(!value){
      return [];
    }

    try{
      const parsed = JSON.parse(value);
      if(Array.isArray(parsed)){
        return parsed;
      }
    }catch(err){
      console.warn('Unable to parse stored account data', err);
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
    const value = safeCall(() => localStorage.getItem(ACTIVE_ACCOUNT_KEY));
    return value || null;
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

  function ensureStorageEnabled(){
    if(storageAvailable){
      return true;
    }
    showAccountError('Local storage is disabled, so accounts cannot be saved.');
    return false;
  }

  function readStoredPosts(){
    const value = safeCall(() => localStorage.getItem(STORAGE_KEY));
    if(!value){
      return null;
    }

    try{
      const parsed = JSON.parse(value);
      if(Array.isArray(parsed)){
        return parsed;
      }
    }catch(err){
      console.warn('Unable to parse stored forum data', err);
    }
    return null;
  }

  function savePosts(posts){
    safeCall(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(posts)));
  }

  function createDemoPosts(){
    const now = new Date();
    const iso = (offsetHours) => new Date(now.getTime() - offsetHours * 3600 * 1000).toISOString();
    return [
      {
        id: 'demo-1',
        title: 'Show us your best Turn & Burn drift!',
        body: 'Drop a clip of your cleanest drift lines or photo-finish wins. Bonus points for camera shake and neon trails.',
        author: 'ExtynctMod',
        category: 'Showcase',
        createdAt: iso(18),
        media: [
          {
            type: 'image',
            src: '/assets/images/turnandburn/header.jpg'
          }
        ]
      },
      {
        id: 'demo-2',
        title: 'IonCore alpha build feedback thread',
        body: 'We pushed a patch with new dash timing. Let us know how it feels and if the cooldown creates any weird loops.',
        author: 'GearboundDev',
        category: 'Feedback',
        createdAt: iso(36),
        media: [
          {
            type: 'video',
            src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4'
          }
        ]
      },
      {
        id: 'demo-3',
        title: 'Fan art: WarpGate sunset concept',
        body: 'Tried pushing the color palette into warmer territory while keeping the synthwave skyline vibe. Thoughts?',
        author: 'NovaRacer',
        category: 'General',
        createdAt: iso(60),
        media: [
          {
            type: 'image',
            src: '/assets/images/warpgate/header.jpg'
          }
        ]
      }
    ];
  }

  function formatDate(value){
    try{
      return new Date(value).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }catch(err){
      return value;
    }
  }

  function createId(prefix = 'post'){
    if(typeof crypto !== 'undefined' && crypto.randomUUID){
      const uuid = crypto.randomUUID();
      return prefix ? `${prefix}-${uuid}` : uuid;
    }
    const fallback = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    return prefix ? `${prefix}-${fallback}` : fallback;
  }

  function parseMediaLink(value){
    if(!value){
      return null;
    }
    let parsed;
    try{
      parsed = new URL(value);
    }catch(err){
      return null;
    }

    const pathname = parsed.pathname.toLowerCase();
    const ext = pathname.split('.').pop();
    const imageExt = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
    const videoExt = ['mp4', 'webm', 'ogg', 'mov'];

    if(imageExt.includes(ext)){
      return { type: 'image', src: parsed.href };
    }
    if(videoExt.includes(ext)){
      return { type: 'video', src: parsed.href };
    }

    if(parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')){
      const videoId = parsed.searchParams.get('v') || pathname.replace('/', '');
      if(videoId){
        return {
          type: 'embed',
          provider: 'youtube',
          src: `https://www.youtube.com/embed/${videoId}`
        };
      }
    }

    return {
      type: 'link',
      src: parsed.href
    };
  }

  function readFileAsDataUrl(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  async function extractMedia(fileInput, linkInput){
    const file = fileInput && fileInput.files ? fileInput.files[0] : null;
    const link = linkInput ? linkInput.value.trim() : '';

    if(file){
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      const maxImageSize = 5 * 1024 * 1024;
      const maxVideoSize = 20 * 1024 * 1024;

      if(isImage && file.size > maxImageSize){
        throw new Error('Images must be 5 MB or smaller.');
      }
      if(isVideo && file.size > maxVideoSize){
        throw new Error('Videos must be 20 MB or smaller.');
      }

      const dataUrl = await readFileAsDataUrl(file);
      return [
        {
          type: isVideo ? 'video' : 'image',
          src: dataUrl,
          name: file.name
        }
      ];
    }

    const parsed = parseMediaLink(link);
    if(parsed){
      return [parsed];
    }

    return [];
  }

  function renderBody(body){
    const container = document.createElement('div');
    const paragraphs = body.split(/\n{2,}/).filter(Boolean);

    if(paragraphs.length === 0){
      const line = document.createElement('p');
      line.textContent = body.trim();
      container.appendChild(line);
      return container;
    }

    paragraphs.forEach((chunk) => {
      const p = document.createElement('p');
      p.textContent = chunk.trim();
      container.appendChild(p);
    });

    return container;
  }

  function renderMedia(media){
    const wrapper = document.createElement('div');
    wrapper.className = 'forum-media-group';

    media.forEach((item) => {
      const mediaContainer = document.createElement('div');
      mediaContainer.className = 'forum-media';

      if(item.type === 'image'){
        const img = document.createElement('img');
        img.src = item.src;
        img.alt = item.name ? `${item.name} attachment` : 'Post attachment';
        img.loading = 'lazy';
        mediaContainer.appendChild(img);
      }else if(item.type === 'video'){
        const video = document.createElement('video');
        video.controls = true;
        video.src = item.src;
        video.preload = 'metadata';
        mediaContainer.appendChild(video);
      }else if(item.type === 'embed' && item.provider === 'youtube'){
        const iframe = document.createElement('iframe');
        iframe.src = item.src;
        iframe.width = '560';
        iframe.height = '315';
        iframe.loading = 'lazy';
        iframe.allowFullscreen = true;
        iframe.setAttribute('title', 'Embedded video');
        mediaContainer.appendChild(iframe);
      }else if(item.type === 'link'){
        const link = document.createElement('a');
        link.href = item.src;
        link.target = '_blank';
        link.rel = 'noopener';
        link.className = 'forum-media-link';
        link.textContent = 'Open attached link';
        mediaContainer.appendChild(link);
      }

      wrapper.appendChild(mediaContainer);
    });

    return wrapper;
  }

  function getActiveAccount(){
    if(!Array.isArray(accounts)){
      return null;
    }
    return accounts.find((acct) => acct.id === activeAccountId) || null;
  }

  function updateAuthorField(){
    if(!authorInput){
      return;
    }
    const activeAccount = getActiveAccount();
    if(activeAccount){
      authorInput.value = activeAccount.displayName;
      authorInput.disabled = true;
      authorInput.setAttribute('data-locked', 'true');
      authorInput.title = 'Using display name from your forum account';
    }else{
      if(authorInput.getAttribute('data-locked')){
        authorInput.value = '';
        authorInput.removeAttribute('data-locked');
      }
      authorInput.disabled = false;
      authorInput.removeAttribute('title');
    }
  }

  function updateAccountUI(){
    if(!Array.isArray(accounts)){
      accounts = [];
    }

    let activeAccount = getActiveAccount();
    if(activeAccountId && !activeAccount){
      activeAccountId = null;
      saveActiveAccountId(null);
    }

    activeAccount = getActiveAccount();

    if(accountStatusEl){
      if(activeAccount){
        accountStatusEl.textContent = `Signed in as @${activeAccount.displayName}`;
      }else if(accounts.length > 0){
        accountStatusEl.textContent = 'Select an account to sign in.';
      }else{
        accountStatusEl.textContent = 'No account selected';
      }
    }

    if(accountPicker && accountPickerWrapper){
      accountPicker.innerHTML = '';
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = accounts.length > 0 ? 'Choose an account' : 'No saved accounts yet';
      accountPicker.appendChild(placeholder);

      accounts.forEach((acct) => {
        const option = document.createElement('option');
        option.value = acct.id;
        option.textContent = `@${acct.displayName}`;
        accountPicker.appendChild(option);
      });

      accountPickerWrapper.hidden = accounts.length === 0;
      accountPicker.value = activeAccount ? activeAccount.id : '';
    }

    if(accountSignOut){
      accountSignOut.hidden = !activeAccount;
    }

    updateAuthorField();
  }

  function setActiveAccount(id){
    activeAccountId = id || null;
    saveActiveAccountId(activeAccountId);
    updateAccountUI();
  }

  function renderPosts(posts){
    postsContainer.innerHTML = '';
    if(!posts || posts.length === 0){
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;

    const sorted = [...posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    sorted.forEach((post) => {
      const article = document.createElement('article');
      article.className = 'card forum-thread';
      article.setAttribute('data-post-id', post.id);

      const body = document.createElement('div');
      body.className = 'card-body forum-thread-body';

      const header = document.createElement('header');
      header.className = 'forum-thread-header';

      const title = document.createElement('h3');
      title.className = 'forum-thread-title';
      title.textContent = post.title;

      const meta = document.createElement('div');
      meta.className = 'forum-thread-meta';

      const pill = document.createElement('span');
      pill.className = 'forum-pill';
      pill.textContent = post.category || 'General';

      const author = document.createElement('span');
      author.className = 'forum-thread-author';
      author.textContent = post.author ? `@${post.author}` : 'Anonymous player';

      const date = document.createElement('time');
      date.dateTime = post.createdAt;
      date.textContent = formatDate(post.createdAt);

      meta.appendChild(pill);
      meta.appendChild(author);
      meta.appendChild(date);

      header.appendChild(title);
      header.appendChild(meta);

      body.appendChild(header);
      body.appendChild(renderBody(post.body));

      if(post.media && post.media.length > 0){
        body.appendChild(renderMedia(post.media));
      }

      article.appendChild(body);
      postsContainer.appendChild(article);
    });
  }

  function clearForm(){
    form.reset();
    updateAuthorField();
  }

  function showError(message){
    if(!errorEl){
      return;
    }
    errorEl.textContent = message;
    errorEl.hidden = false;
  }

  function clearError(){
    if(!errorEl){
      return;
    }
    errorEl.hidden = true;
    errorEl.textContent = '';
  }

  let accounts = readStoredAccounts();
  let activeAccountId = readActiveAccountId();
  updateAccountUI();

  let posts = readStoredPosts();
  if(!posts){
    posts = createDemoPosts();
    savePosts(posts);
  }
  renderPosts(posts);

  if(accountForm){
    accountForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearAccountAlerts();

      if(!ensureStorageEnabled()){
        return;
      }

      const formData = new FormData(accountForm);
      const displayName = (formData.get('displayName') || '').toString().trim();
      const emailRaw = (formData.get('email') || '').toString().trim();
      const password = (formData.get('password') || '').toString();
      const confirm = (formData.get('confirm') || '').toString();

      if(displayName.length < 3){
        showAccountError('Display name must be at least 3 characters long.');
        return;
      }

      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if(!emailPattern.test(emailRaw)){
        showAccountError('Please enter a valid email address.');
        return;
      }

      if(password.length < 8){
        showAccountError('Passwords must be at least 8 characters long.');
        return;
      }

      if(password !== confirm){
        showAccountError('Passwords do not match.');
        return;
      }

      const normalizedEmail = emailRaw.toLowerCase();
      const normalizedName = displayName.toLowerCase();

      if(accounts.some((acct) => acct.displayName.toLowerCase() === normalizedName)){
        showAccountError('That display name is already used by another local account.');
        return;
      }

      if(accounts.some((acct) => acct.email === normalizedEmail)){
        showAccountError('That email is already connected to a local account.');
        return;
      }

      try{
        const passwordHash = await hashPassword(password);
        const account = {
          id: createId('acct'),
          displayName,
          email: normalizedEmail,
          passwordHash,
          createdAt: new Date().toISOString()
        };

        accounts.push(account);
        saveAccounts(accounts);

        if(!ensureStorageEnabled()){
          accounts.pop();
          return;
        }

        setActiveAccount(account.id);
        accountForm.reset();
        showAccountSuccess(`Account @${account.displayName} saved. You're signed in!`);
      }catch(err){
        console.error('Failed to save forum account', err);
        showAccountError('Something went wrong while saving your account. Please try again.');
      }
    });
  }

  if(accountPicker){
    accountPicker.addEventListener('change', () => {
      clearAccountAlerts();
      const selected = accountPicker.value;

      if(!selected){
        setActiveAccount(null);
        showAccountSuccess('Signed out.');
        return;
      }

      const match = accounts.find((acct) => acct.id === selected);
      if(match){
        setActiveAccount(match.id);
        showAccountSuccess(`Signed in as @${match.displayName}.`);
      }else{
        setActiveAccount(null);
      }
    });
  }

  if(accountSignOut){
    accountSignOut.addEventListener('click', () => {
      clearAccountAlerts();
      setActiveAccount(null);
      showAccountSuccess('Signed out.');
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearError();

    const formData = new FormData(form);
    const title = (formData.get('title') || '').toString().trim();
    const bodyValue = (formData.get('body') || '').toString().trim();

    if(!title){
      showError('Please add a title before posting.');
      return;
    }
    if(!bodyValue){
      showError('Please share a bit more detail so people can help.');
      return;
    }

    try{
      const media = await extractMedia(
        document.getElementById('forum-media-file'),
        document.getElementById('forum-media-link')
      );

      const activeAccount = getActiveAccount();
      const newPost = {
        id: createId(),
        title,
        body: bodyValue,
        author: activeAccount ? activeAccount.displayName : (formData.get('author') || '').toString().trim(),
        category: (formData.get('category') || 'General').toString(),
        createdAt: new Date().toISOString(),
        media
      };

      posts.push(newPost);
      savePosts(posts);
      renderPosts(posts);
      clearForm();
    }catch(err){
      showError(err.message || 'Something went wrong while attaching your media.');
    }
  });

  resetButton.addEventListener('click', () => {
    posts = createDemoPosts();
    savePosts(posts);
    renderPosts(posts);
  });
})();
