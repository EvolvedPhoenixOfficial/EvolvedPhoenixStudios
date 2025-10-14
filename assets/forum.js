(function(){
  const ROOT = document.getElementById('forum-root');
  if(!ROOT || !window.communityStorage){
    return;
  }

  const storage = window.communityStorage;

  const form = document.getElementById('forum-form');
  const postsContainer = document.getElementById('forum-posts');
  const emptyState = document.getElementById('forum-empty');
  const lockedMessage = document.getElementById('forum-form-locked');
  const errorEl = document.getElementById('forum-form-error');
  const successEl = document.getElementById('forum-form-success');
  const storageWarning = document.getElementById('forum-storage-warning');
  const sessionStatusEl = document.getElementById('forum-session-status');
  const signOutButton = document.getElementById('forum-signout');

  const mediaFileInput = document.getElementById('forum-media-file');
  const mediaLinkInput = document.getElementById('forum-media-link');

  const defaultEmptyMessage = emptyState ? emptyState.textContent : '';

  const IMAGE_LIMIT = 2 * 1024 * 1024; // 2 MB
  const VIDEO_LIMIT = 6 * 1024 * 1024; // 6 MB

  let posts = storage.getPosts();
  let activeAccount = storage.getActiveAccount();
  let isSubmitting = false;

  function escapeHtml(value){
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function clearMessages(){
    if(errorEl){
      errorEl.hidden = true;
      errorEl.textContent = '';
    }
    if(successEl){
      successEl.hidden = true;
      successEl.textContent = '';
    }
  }

  function showError(message){
    if(!errorEl){
      return;
    }
    errorEl.textContent = message;
    errorEl.hidden = false;
    if(successEl){
      successEl.hidden = true;
      successEl.textContent = '';
    }
  }

  function showSuccess(message){
    if(!successEl){
      return;
    }
    successEl.textContent = message;
    successEl.hidden = false;
    if(errorEl){
      errorEl.hidden = true;
      errorEl.textContent = '';
    }
  }

  function setFormEnabled(enabled){
    if(!form){
      return;
    }
    form.classList.toggle('forum-form-disabled', !enabled);
    const fields = form.querySelectorAll('input, textarea, select, button');
    fields.forEach((field) => {
      if(field.type === 'button'){
        return;
      }
      field.disabled = !enabled;
    });
    if(lockedMessage){
      lockedMessage.hidden = enabled;
    }
  }

  function setSubmitting(state){
    isSubmitting = state;
    if(!form){
      return;
    }
    const submitButton = form.querySelector('button[type="submit"]');
    if(submitButton){
      submitButton.disabled = state || !activeAccount;
      submitButton.textContent = state ? 'Sharing…' : 'Share post';
    }
  }

  function updateStorageWarning(forceShow){
    if(!storageWarning){
      return;
    }
    const shouldShow = Boolean(forceShow) || !storage.hasStorage();
    storageWarning.hidden = !shouldShow;
  }

  function updateSessionStatus(customMessage){
    activeAccount = storage.getActiveAccount();
    if(sessionStatusEl){
      if(customMessage){
        sessionStatusEl.textContent = customMessage;
      }else if(activeAccount){
        sessionStatusEl.textContent = 'Signed in as @' + activeAccount.username + '. Posts stay on this device.';
      }else{
        sessionStatusEl.textContent = 'Not signed in. Visit the account page to create or sign in.';
      }
    }
    if(signOutButton){
      signOutButton.hidden = !activeAccount;
    }
    setFormEnabled(Boolean(activeAccount));
  }

  function validateLink(url){
    if(!url){
      return false;
    }
    try{
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    }catch(err){
      return false;
    }
  }

  function readFileAsDataUrl(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Unable to read the selected file.'));
      reader.readAsDataURL(file);
    });
  }

  function renderMedia(media){
    if(!media){
      return '';
    }

    if(media.type === 'file'){
      const dataUrl = media.dataUrl || '';
      if(!dataUrl){
        return '';
      }
      const isVideo = /^video\//i.test(media.mimeType || '');
      if(isVideo){
        return `
          <div class="forum-media-group">
            <div class="forum-media">
              <video controls preload="metadata">
                <source src="${escapeHtml(dataUrl)}" type="${escapeHtml(media.mimeType || 'video/mp4')}" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>`;
      }
      return `
        <div class="forum-media-group">
          <div class="forum-media">
            <img src="${escapeHtml(dataUrl)}" alt="Attachment from ${escapeHtml(media.originalName || 'post')}" loading="lazy" />
          </div>
        </div>`;
    }

    if(media.type === 'link'){
      const safeUrl = escapeHtml(media.url || '');
      if(!safeUrl){
        return '';
      }
      return `
        <div class="forum-media-group">
          <div class="forum-media">
            <a class="forum-media-link" href="${safeUrl}" target="_blank" rel="noopener">View attached media</a>
          </div>
        </div>`;
    }

    return '';
  }

  function renderPosts(){
    if(!postsContainer){
      return;
    }

    const list = Array.isArray(posts) ? posts.slice() : [];
    if(list.length === 0){
      if(emptyState){
        emptyState.textContent = defaultEmptyMessage;
        emptyState.hidden = false;
      }
      postsContainer.innerHTML = '';
      return;
    }

    list.sort((a, b) => {
      const aTime = new Date(a && a.createdAt ? a.createdAt : 0).getTime();
      const bTime = new Date(b && b.createdAt ? b.createdAt : 0).getTime();
      return bTime - aTime;
    });

    if(emptyState){
      emptyState.hidden = true;
    }

    const markup = list.map((post) => {
      const created = new Date(post.createdAt || Date.now());
      const formattedDate = created.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
      const paragraphs = String(post.body || '')
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => `<p>${escapeHtml(line)}</p>`)
        .join('');

      const authorName = post.author && post.author.username ? post.author.username : post.authorName || 'unknown';

      return `
        <article class="card forum-thread" data-post-id="${escapeHtml(post.id || '')}">
          <div class="card-body forum-thread-body">
            <header class="forum-thread-header">
              <h3 class="forum-thread-title">${escapeHtml(post.title || 'Untitled post')}</h3>
              <div class="forum-thread-meta">
                <span class="forum-pill">${escapeHtml(post.category || 'General')}</span>
                <span class="forum-thread-author">@${escapeHtml(authorName || 'unknown')}</span>
                <time datetime="${escapeHtml(post.createdAt || '')}">${escapeHtml(formattedDate)}</time>
              </div>
            </header>
            ${paragraphs || '<p>No content provided.</p>'}
            ${renderMedia(post.media)}
          </div>
        </article>`;
    }).join('\n');

    postsContainer.innerHTML = markup;
  }

  function refreshPosts(){
    posts = storage.getPosts();
    renderPosts();
  }

  async function handleSubmit(event){
    event.preventDefault();
    if(isSubmitting){
      return;
    }

    clearMessages();

    activeAccount = storage.getActiveAccount();
    if(!activeAccount){
      showError('Sign in before posting.');
      return;
    }

    if(!form){
      return;
    }

    const formData = new FormData(form);
    const category = String(formData.get('category') || 'General');
    const title = String(formData.get('title') || '').trim();
    const body = String(formData.get('body') || '').trim();
    const file = mediaFileInput && mediaFileInput.files ? mediaFileInput.files[0] : null;
    const linkValue = mediaLinkInput ? String(mediaLinkInput.value || '').trim() : '';

    if(!title){
      showError('Give your post a title.');
      return;
    }
    if(!body){
      showError('Share some details in the body field.');
      return;
    }
    if(file && linkValue){
      showError('Please choose either an upload or a link, not both.');
      return;
    }
    if(linkValue && !validateLink(linkValue)){
      showError('Enter a valid media link that starts with http:// or https://.');
      return;
    }

    let media = null;
    if(file){
      const isVideo = /^video\//i.test(file.type || '');
      const sizeLimit = isVideo ? VIDEO_LIMIT : IMAGE_LIMIT;
      if(file.size > sizeLimit){
        showError(isVideo ? 'Video uploads must be 6 MB or smaller.' : 'Image uploads must be 2 MB or smaller.');
        return;
      }
    }

    setSubmitting(true);

    try{
      if(file){
        const dataUrl = await readFileAsDataUrl(file);
        media = {
          type: 'file',
          dataUrl,
          mimeType: file.type,
          originalName: file.name
        };
      }else if(linkValue){
        media = {
          type: 'link',
          url: linkValue
        };
      }

      const newPost = {
        id: storage.createUid('post'),
        title,
        body,
        category,
        author: {
          username: activeAccount.username,
          email: activeAccount.email || ''
        },
        createdAt: new Date().toISOString(),
        media
      };

      const updatedPosts = storage.getPosts();
      updatedPosts.push(newPost);
      const stored = storage.savePosts(updatedPosts);

      refreshPosts();

      if(form){
        form.reset();
      }
      if(mediaFileInput){
        mediaFileInput.value = '';
      }

      if(stored && storage.hasStorage()){
        showSuccess('Post shared! It will stick around on this device.');
      }else{
        showSuccess('Post shared for this session. Enable local storage to keep it after closing the tab.');
        updateStorageWarning(true);
      }
    }catch(err){
      console.error('Failed to submit forum post.', err);
      showError(err.message || 'Unable to save the post.');
    }finally{
      setSubmitting(false);
    }
  }

  function handleSignOut(){
    storage.clearActiveAccount();
    activeAccount = null;
    clearMessages();
    updateSessionStatus('Signed out.');
    updateStorageWarning(!storage.hasStorage());
  }

  if(form){
    form.addEventListener('submit', handleSubmit);
  }
  if(signOutButton){
    signOutButton.addEventListener('click', handleSignOut);
  }

  updateStorageWarning(!storage.hasStorage() && !activeAccount);
  updateSessionStatus();
  setFormEnabled(Boolean(activeAccount));
  renderPosts();
})();
