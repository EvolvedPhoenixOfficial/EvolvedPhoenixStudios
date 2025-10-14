(function(){
  const ROOT = document.getElementById('forum-root');
  if(!ROOT){
    return;
  }

  const STORAGE_KEY = 'extynct-forum-posts';
  const form = document.getElementById('forum-form');
  const postsContainer = document.getElementById('forum-posts');
  const emptyState = document.getElementById('forum-empty');
  const errorEl = document.getElementById('forum-form-error');
  const storageWarning = document.getElementById('forum-storage-warning');
  const resetButton = document.getElementById('forum-reset');

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

  function createId(){
    if(typeof crypto !== 'undefined' && crypto.randomUUID){
      return crypto.randomUUID();
    }
    return `post-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

  let posts = readStoredPosts();
  if(!posts){
    posts = createDemoPosts();
    savePosts(posts);
  }
  renderPosts(posts);

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

      const newPost = {
        id: createId(),
        title,
        body: bodyValue,
        author: (formData.get('author') || '').toString().trim(),
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
