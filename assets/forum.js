(function(){
  const ROOT = document.getElementById('forum-root');
  if(!ROOT || !window.repoStorage){
    return;
  }

  const client = repoStorage.createClient(ROOT);

  const form = document.getElementById('forum-form');
  const postsContainer = document.getElementById('forum-posts');
  const emptyState = document.getElementById('forum-empty');
  const lockedMessage = document.getElementById('forum-form-locked');
  const errorEl = document.getElementById('forum-form-error');
  const storageWarning = document.getElementById('forum-storage-warning');
  const sessionStatusEl = document.getElementById('forum-session-status');
  const signOutButton = document.getElementById('forum-signout');

  const mediaFileInput = document.getElementById('forum-media-file');
  const mediaLinkInput = document.getElementById('forum-media-link');

  const defaultEmptyMessage = emptyState ? emptyState.textContent : '';

  let posts = [];
  let activeAccount = client.getActiveAccount();
  let isSubmitting = false;

  function escapeHtml(value){
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
    const fields = form.querySelectorAll('input, textarea, select, button');
    fields.forEach((field) => {
      field.disabled = !enabled && field.type !== 'button';
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
      submitButton.disabled = state;
      submitButton.textContent = state ? 'Sharing…' : 'Share post';
    }
  }

  function updateStorageWarning(){
    if(storageWarning){
      storageWarning.hidden = client.hasStorage();
    }
  }

  function updateSessionStatus(message){
    if(sessionStatusEl){
      if(message){
        sessionStatusEl.textContent = message;
      }else if(activeAccount){
        let text = `Signed in as @${activeAccount.username}.`;
        if(!client.getToken()){
          text += ' Add your GitHub token on the account page before posting.';
        }
        sessionStatusEl.textContent = text;
      }else{
        sessionStatusEl.textContent = 'Not signed in. Visit the account page to create or sign in.';
      }
    }
    if(signOutButton){
      signOutButton.hidden = !activeAccount;
    }
    setFormEnabled(Boolean(activeAccount));
  }

  function getMediaUrl(media){
    if(!media){
      return '';
    }
    if(media.rawUrl){
      return media.rawUrl;
    }
    if(media.url){
      return media.url;
    }
    if(media.path){
      const normalized = String(media.path).replace(/^\//, '');
      return `/${normalized}`;
    }
    return '';
  }

  function renderMedia(media){
    if(!media){
      return '';
    }
    if(media.type === 'file'){
      const url = getMediaUrl(media);
      if(!url){
        return '';
      }
      const isVideo = /^video\//i.test(media.mimeType || '');
      if(isVideo){
        return `
          <div class="forum-media-group">
            <div class="forum-media">
              <video controls preload="metadata">
                <source src="${escapeHtml(url)}" type="${escapeHtml(media.mimeType || 'video/mp4')}" />
                Your browser does not support the video tag.
              </video>
            </div>
          </div>`;
      }
      return `
        <div class="forum-media-group">
          <div class="forum-media">
            <img src="${escapeHtml(url)}" alt="Attachment from ${escapeHtml(media.originalName || 'post')}" loading="lazy" />
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

      return `
        <article class="card forum-thread" data-post-id="${escapeHtml(post.id || '')}">
          <div class="card-body forum-thread-body">
            <header class="forum-thread-header">
              <h3 class="forum-thread-title">${escapeHtml(post.title || 'Untitled post')}</h3>
              <div class="forum-thread-meta">
                <span class="forum-pill">${escapeHtml(post.category || 'General')}</span>
                <span class="forum-thread-author">@${escapeHtml(post.authorName || 'unknown')}</span>
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

  async function loadPosts(){
    try{
      posts = await client.fetchJson('data/posts.json', []);
      renderPosts();
    }catch(err){
      console.error('Unable to load posts from GitHub.', err);
      posts = [];
      if(emptyState){
        emptyState.textContent = 'Unable to load posts from the repository right now.';
        emptyState.hidden = false;
      }
    }
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

  async function handleSubmit(event){
    event.preventDefault();
    if(isSubmitting){
      return;
    }
    clearError();

    if(!activeAccount){
      showError('Sign in before posting.');
      return;
    }

    if(!client.getToken()){
      showError('Add your GitHub personal access token on the account page before posting.');
      return;
    }

    const config = client.getConfig();
    if(!config.owner || !config.repo){
      showError('Update the repository settings on the account page before posting.');
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
      const sizeLimit = isVideo ? 20 * 1024 * 1024 : 5 * 1024 * 1024;
      if(file.size > sizeLimit){
        showError(isVideo ? 'Video uploads must be 20 MB or smaller.' : 'Image uploads must be 5 MB or smaller.');
        return;
      }
    }

    setSubmitting(true);

    try{
      if(file){
        const safeName = client.slugifyFileName(file.name || 'upload');
        const uniqueName = `${repoStorage.createUid('upload')}-${safeName}`;
        const path = `uploads/forum/${uniqueName}`;
        const uploadResult = await client.uploadFile(path, file, `Add forum upload ${safeName}`);
        media = {
          type: 'file',
          path: uploadResult.path,
          url: uploadResult.url,
          rawUrl: uploadResult.rawUrl,
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
        id: repoStorage.createUid('post'),
        title,
        body,
        category,
        authorName: activeAccount.username,
        authorEmail: activeAccount.email || '',
        createdAt: new Date().toISOString(),
        media
      };

      posts = await client.updateJson('data/posts.json', (data) => {
        const existing = Array.isArray(data) ? data.slice() : [];
        existing.push(newPost);
        return existing;
      }, `Add forum post ${title.slice(0, 60)}`, []);

      if(form){
        form.reset();
      }
      renderPosts();
      updateSessionStatus('Post saved to the repository.');
      window.setTimeout(() => updateSessionStatus(), 3000);
    }catch(err){
      console.error('Failed to submit forum post.', err);
      showError(err.message || 'Unable to save the post to GitHub.');
    }finally{
      setSubmitting(false);
    }
  }

  function handleSignOut(){
    client.clearActiveAccount();
    activeAccount = null;
    updateSessionStatus('Signed out.');
    updateStorageWarning();
  }

  if(form){
    form.addEventListener('submit', handleSubmit);
  }
  if(signOutButton){
    signOutButton.addEventListener('click', handleSignOut);
  }

  updateStorageWarning();
  updateSessionStatus();
  setFormEnabled(Boolean(activeAccount));
  loadPosts();
})();
