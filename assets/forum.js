(function(){
  const ROOT = document.getElementById('forum-root');
  if(!ROOT){
    return;
  }

  const TOKEN_STORAGE_KEY = 'extynct-auth-token';
  const API_BASE = '/api';

  const form = document.getElementById('forum-form');
  const postsContainer = document.getElementById('forum-posts');
  const emptyState = document.getElementById('forum-empty');
  const errorEl = document.getElementById('forum-form-error');
  const storageWarning = document.getElementById('forum-storage-warning');
  const lockedMessage = document.getElementById('forum-form-locked');
  const sessionStatusEl = document.getElementById('forum-session-status');
  const signOutButton = document.getElementById('forum-signout');

  let activeAccount = null;
  let posts = [];

  function showStorageWarning(){
    if(storageWarning){
      storageWarning.hidden = false;
    }
  }

  function hideStorageWarning(){
    if(storageWarning){
      storageWarning.hidden = true;
    }
  }

  function getToken(){
    try{
      return localStorage.getItem(TOKEN_STORAGE_KEY) || '';
    }catch(err){
      console.warn('Unable to access stored token', err);
      showStorageWarning();
      return '';
    }
  }

  function setToken(token){
    try{
      if(token){
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
        hideStorageWarning();
      }else{
        localStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    }catch(err){
      console.warn('Failed to persist token', err);
      showStorageWarning();
    }
  }

  function clearError(){
    if(errorEl){
      errorEl.hidden = true;
      errorEl.textContent = '';
    }
  }

  function showError(message){
    if(!errorEl){
      return;
    }
    errorEl.textContent = message;
    errorEl.hidden = false;
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
    if(lockedMessage){
      lockedMessage.hidden = enabled;
    }
  }

  function escapeHtml(value){
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderMedia(media){
    if(!media){
      return '';
    }
    let content = '';
    if(media.type === 'file'){
      const isVideo = /^video\//i.test(media.mimeType || '');
      if(isVideo){
        content = `
          <div class="forum-media">
            <video controls preload="metadata">
              <source src="${media.url}" type="${media.mimeType || 'video/mp4'}" />
              Your browser does not support the video tag.
            </video>
          </div>`;
      }else{
        content = `
          <div class="forum-media">
            <img src="${media.url}" alt="Attachment from ${escapeHtml(media.originalName || 'post')}" loading="lazy" />
          </div>`;
      }
    }else if(media.type === 'link'){
      const safeUrl = media.url ? media.url : '#';
      content = `
        <div class="forum-media">
          <a class="forum-media-link" href="${safeUrl}" target="_blank" rel="noopener">View attached media</a>
        </div>`;
    }

    if(!content){
      return '';
    }
    return `
      <div class="forum-media-group">${content}
      </div>`;
  }

  function renderPosts(){
    if(!postsContainer){
      return;
    }

    if(!Array.isArray(posts) || posts.length === 0){
      if(emptyState){
        emptyState.hidden = false;
      }
      postsContainer.innerHTML = '';
      return;
    }

    if(emptyState){
      emptyState.hidden = true;
    }

    const markup = posts.map((post) => {
      const created = new Date(post.createdAt);
      const formattedDate = created.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
      const title = escapeHtml(post.title || 'Untitled post');
      const paragraphs = String(post.body || '').split(/\n+/).map((line) => escapeHtml(line.trim())).filter(Boolean);
      const bodyContent = paragraphs.length > 0
        ? paragraphs.map((text) => `<p>${text}</p>`).join('')
        : '<p>No content provided.</p>';

      return `
        <article class="card forum-thread" data-post-id="${escapeHtml(post.id || '')}">
          <div class="card-body forum-thread-body">
            <header class="forum-thread-header">
              <h3 class="forum-thread-title">${title}</h3>
              <div class="forum-thread-meta">
                <span class="forum-pill">${escapeHtml(post.category || 'General')}</span>
                <span class="forum-thread-author">@${escapeHtml(post.authorName || 'unknown')}</span>
                <time datetime="${escapeHtml(post.createdAt || '')}">${formattedDate}</time>
              </div>
            </header>
            ${bodyContent}
            ${renderMedia(post.media)}
          </div>
        </article>`;
    }).join('\n');

    postsContainer.innerHTML = markup;
  }

  function updateSessionStatus(message){
    if(sessionStatusEl){
      if(message){
        sessionStatusEl.textContent = message;
      }else if(activeAccount){
        sessionStatusEl.textContent = `Signed in as @${activeAccount.username}`;
      }else{
        sessionStatusEl.textContent = 'Not signed in. Visit the account page to create or sign in.';
      }
    }
    if(signOutButton){
      signOutButton.hidden = !activeAccount;
    }
    setFormEnabled(Boolean(activeAccount));
  }

  async function requestJson(path, options){
    const opts = Object.assign({}, options || {});
    opts.headers = Object.assign({ 'Accept': 'application/json' }, opts.headers || {});
    const token = getToken();
    if(token){
      opts.headers['Authorization'] = `Bearer ${token}`;
    }
    if(opts.body && !(opts.body instanceof FormData)){
      if(typeof opts.body !== 'string'){
        opts.body = JSON.stringify(opts.body);
      }
      if(!opts.headers['Content-Type']){
        opts.headers['Content-Type'] = 'application/json';
      }
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

  async function fetchPosts(){
    try{
      const result = await requestJson('/posts', { method: 'GET' });
      posts = Array.isArray(result && result.posts) ? result.posts : [];
    }catch(err){
      console.warn('Failed to load posts', err);
      posts = [];
    }
    renderPosts();
  }

  async function refreshSession(){
    const token = getToken();
    if(!token){
      activeAccount = null;
      updateSessionStatus();
      return;
    }

    try{
      const result = await requestJson('/auth/session', { method: 'GET' });
      activeAccount = result && result.account ? result.account : null;
    }catch(err){
      console.warn('Unable to refresh session', err);
      activeAccount = null;
      setToken('');
    }
    updateSessionStatus();
  }

  async function handleSignOut(){
    const token = getToken();
    if(!token){
      activeAccount = null;
      setToken('');
      updateSessionStatus('Signed out.');
      return;
    }

    try{
      await requestJson('/auth/signout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
    }catch(err){
      console.warn('Sign-out failed', err);
    }

    activeAccount = null;
    setToken('');
    updateSessionStatus('Signed out.');
  }

  function fileToDataUrl(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('Unable to read attachment.'));
      reader.readAsDataURL(file);
    });
  }

  function setSubmitting(isSubmitting){
    if(!form){
      return;
    }
    const submitButton = form.querySelector('button[type="submit"]');
    if(submitButton){
      submitButton.disabled = isSubmitting;
    }
    if(isSubmitting){
      form.classList.add('is-submitting');
    }else{
      form.classList.remove('is-submitting');
    }
  }

  async function handleSubmit(event){
    event.preventDefault();
    clearError();

    if(!form){
      return;
    }

    if(!activeAccount){
      showError('Sign in before creating a post.');
      return;
    }

    const formData = new FormData(form);
    const category = formData.get('category');
    const title = formData.get('title');
    const bodyValue = formData.get('body');
    const mediaLink = formData.get('mediaLink');
    const mediaFile = formData.get('mediaFile');

    const payload = {
      category: category && String(category).trim(),
      title: title && String(title),
      body: bodyValue && String(bodyValue)
    };

    if(mediaLink){
      payload.mediaLink = String(mediaLink).trim();
    }

    if(mediaFile && mediaFile.size){
      const isImage = /^image\//i.test(mediaFile.type || '');
      const sizeLimit = isImage ? 5 * 1024 * 1024 : 20 * 1024 * 1024;
      if(mediaFile.size > sizeLimit){
        showError(isImage ? 'Images must be 5MB or smaller.' : 'Videos must be 20MB or smaller.');
        return;
      }
      try{
        const dataUrl = await fileToDataUrl(mediaFile);
        payload.mediaUpload = {
          name: mediaFile.name,
          type: mediaFile.type,
          dataUrl
        };
      }catch(err){
        console.warn('Failed to encode attachment', err);
        showError('Unable to read the selected file.');
        return;
      }
    }

    setSubmitting(true);
    try{
      const result = await requestJson('/posts', {
        method: 'POST',
        body: payload
      });

      if(result && result.post){
        posts.unshift(result.post);
        renderPosts();
      }
      form.reset();
    }catch(err){
      showError(err.message || 'Unable to create post.');
    }finally{
      setSubmitting(false);
    }
  }

  if(form){
    form.addEventListener('submit', handleSubmit);
  }
  if(signOutButton){
    signOutButton.addEventListener('click', handleSignOut);
  }

  refreshSession();
  fetchPosts();
})();
