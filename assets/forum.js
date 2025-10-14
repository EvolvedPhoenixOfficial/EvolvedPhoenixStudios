(function(){
  const ROOT = document.getElementById('forum-root');
  if(!ROOT){
    return;
  }

  const STORAGE_KEY = 'extynct-forum-posts';
  const ACCOUNT_STORAGE_KEY = 'extynct-accounts';
  const LEGACY_ACCOUNT_STORAGE_KEY = 'extynct-forum-accounts';
  const ACTIVE_ACCOUNT_KEY = 'extynct-active-account';

  const form = document.getElementById('forum-form');
  const postsContainer = document.getElementById('forum-posts');
  const emptyState = document.getElementById('forum-empty');
  const errorEl = document.getElementById('forum-form-error');
  const storageWarning = document.getElementById('forum-storage-warning');
  const lockedMessage = document.getElementById('forum-form-locked');
  const sessionStatusEl = document.getElementById('forum-session-status');
  const signOutButton = document.getElementById('forum-signout');

  let storageAvailable = true;
  let posts = [];
  let accounts = [];
  let activeAccountId = null;

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
      if(typeof updateSessionStatus === 'function'){
        try{
          updateSessionStatus('Local storage is disabled, so posting is locked.');
        }catch(updateErr){
          console.warn('Unable to update session status after storage failure', updateErr);
        }
      }
      return null;
    }
  }

  function clearLegacyAccountStorage(){
    safeCall(() => localStorage.removeItem(LEGACY_ACCOUNT_STORAGE_KEY));
  }

  function readStoredPosts(){
    const raw = safeCall(() => localStorage.getItem(STORAGE_KEY));
    if(!raw){
      return [];
    }

    try{
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed)){
        return parsed;
      }
    }catch(err){
      console.warn('Failed to parse forum posts', err);
    }
    return [];
  }

  function savePosts(list){
    if(!Array.isArray(list)){
      return;
    }
    safeCall(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(list)));
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
      console.warn('Failed to parse account list', err);
    }
    return [];
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

  function getActiveAccount(){
    if(!Array.isArray(accounts) || !activeAccountId){
      return null;
    }
    return accounts.find((acct) => acct && acct.id === activeAccountId) || null;
  }

  function setFormEnabled(enabled){
    if(!form){
      return;
    }
    const elements = form.querySelectorAll('input, textarea, select, button');
    elements.forEach((element) => {
      if(element === lockedMessage){
        return;
      }
      element.disabled = !enabled && element.type !== 'button';
    });
    form.classList.toggle('forum-form-disabled', !enabled);
    if(lockedMessage){
      lockedMessage.hidden = enabled;
    }
  }

  function updateSessionStatus(message){
    let activeAccount = getActiveAccount();

    if(activeAccountId && !activeAccount){
      activeAccountId = null;
      saveActiveAccountId(null);
      activeAccount = null;
    }

    if(sessionStatusEl){
      if(message){
        sessionStatusEl.textContent = message;
      }else if(activeAccount){
        sessionStatusEl.textContent = `Signed in as @${activeAccount.username}.`;
      }else{
        sessionStatusEl.textContent = 'Not signed in. Visit the account page to create or sign in.';
      }
    }

    if(signOutButton){
      signOutButton.hidden = !activeAccount;
    }

    const canPost = Boolean(activeAccount) && storageAvailable;
    setFormEnabled(canPost);

    if(!storageAvailable && storageWarning){
      storageWarning.hidden = false;
    }
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

  function ensureStorage(){
    if(storageAvailable){
      return true;
    }
    showError('Local storage is disabled, so posts cannot be saved.');
    return false;
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

  function renderPosts(list){
    if(!postsContainer || !emptyState){
      return;
    }

    postsContainer.innerHTML = '';

    if(!Array.isArray(list) || list.length === 0){
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;

    const sorted = [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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
    if(!form){
      return;
    }
    form.reset();
  }

  function readState(){
    posts = readStoredPosts();
    accounts = readAccounts();
    activeAccountId = readActiveAccountId();
  }

  clearLegacyAccountStorage();
  readState();
  renderPosts(posts);
  updateSessionStatus();

  if(form){
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearError();

      if(!ensureStorage()){
        return;
      }

      const activeAccount = getActiveAccount();
      if(!activeAccount){
        updateSessionStatus('You must sign in before posting.');
        showError('Please sign in on the account page before posting.');
        return;
      }

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

        const newPost = {
          id: createId(),
          title,
          body: bodyValue,
          author: activeAccount.username,
          category: (formData.get('category') || 'General').toString(),
          createdAt: new Date().toISOString(),
          media
        };

        posts.push(newPost);
        savePosts(posts);
        if(!storageAvailable){
          posts.pop();
          showError('Local storage is disabled, so posts cannot be saved.');
          return;
        }
        renderPosts(posts);
        clearForm();
      }catch(err){
        showError(err.message || 'Something went wrong while attaching your media.');
      }
    });
  }

  if(signOutButton){
    signOutButton.addEventListener('click', () => {
      clearError();
      activeAccountId = null;
      saveActiveAccountId(null);
      updateSessionStatus('Signed out.');
    });
  }

  window.addEventListener('storage', (event) => {
    if(!event){
      return;
    }
    if(event.key === STORAGE_KEY){
      posts = readStoredPosts();
      renderPosts(posts);
    }else if(event.key === ACCOUNT_STORAGE_KEY){
      accounts = readAccounts();
      updateSessionStatus();
    }else if(event.key === ACTIVE_ACCOUNT_KEY){
      activeAccountId = readActiveAccountId();
      updateSessionStatus();
    }
  });
})();
