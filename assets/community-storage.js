(function(){
  const KEYS = {
    activeAccount: 'extynct.community.activeAccount'
  };

  const DEFAULT_CONFIG = {
    owner: '',
    repo: '',
    branch: 'main',
    token: '',
    dataDir: 'hidden/community',
    mediaDir: 'uploads/community'
  };

  const memory = {
    config: null,
    accountsSha: null,
    postsSha: null
  };

  function hasNativeStorage(){
    try{
      const testKey = '__extynct_storage_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    }catch(err){
      return false;
    }
  }

  const storageAvailable = hasNativeStorage();

  function clone(value){
    if(typeof structuredClone === 'function'){
      try{
        return structuredClone(value);
      }catch(err){
        // fall back to manual cloning
      }
    }

    if(Array.isArray(value)){
      return value.map((item) => clone(item));
    }
    if(value && typeof value === 'object'){
      const copy = {};
      for(const key in value){
        if(Object.prototype.hasOwnProperty.call(value, key)){
          copy[key] = clone(value[key]);
        }
      }
      return copy;
    }
    return value;
  }

  function readStorage(key, fallback){
    if(!storageAvailable){
      return clone(fallback);
    }
    try{
      const raw = window.localStorage.getItem(key);
      if(raw === null){
        return clone(fallback);
      }
      return clone(JSON.parse(raw));
    }catch(err){
      return clone(fallback);
    }
  }

  function writeStorage(key, value){
    if(!storageAvailable){
      return false;
    }
    try{
      if(value === undefined || value === null){
        window.localStorage.removeItem(key);
      }else{
        window.localStorage.setItem(key, JSON.stringify(value));
      }
      return true;
    }catch(err){
      return false;
    }
  }

  function sanitizeConfig(partial){
    const next = Object.assign({}, DEFAULT_CONFIG);
    if(partial && typeof partial === 'object'){
      for(const key of Object.keys(DEFAULT_CONFIG)){
        if(Object.prototype.hasOwnProperty.call(partial, key)){
          next[key] = String(partial[key] || '').trim();
        }
      }
    }
    next.branch = next.branch || 'main';
    next.dataDir = next.dataDir || DEFAULT_CONFIG.dataDir;
    next.mediaDir = next.mediaDir || DEFAULT_CONFIG.mediaDir;
    return next;
  }

  function normalizeDir(dir){
    return String(dir || '')
      .replace(/\\+/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+$, '');
  }

  function normalizePath(path){
    return String(path || '')
      .replace(/\\+/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+/g, '/');
  }

  function encodePath(path){
    return normalizePath(path)
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');
  }

  function getConfig(){
    if(memory.config){
      return clone(memory.config);
    }
    const provided = window.communityConfig || {};
    const config = sanitizeConfig(provided);
    memory.config = config;
    return clone(config);
  }

  function refreshConfig(){
    memory.config = sanitizeConfig(window.communityConfig || {});
    memory.accountsSha = null;
    memory.postsSha = null;
    return clone(memory.config);
  }

  function isConfigured(){
    const config = getConfig();
    if(!config.owner || !config.repo || !config.branch || !config.token){
      return false;
    }
    const placeholderTokens = ['YOUR_TOKEN_HERE', 'REPLACE_WITH_TOKEN', ''];
    return !placeholderTokens.includes(config.token);
  }

  function getAccountsPath(){
    const config = getConfig();
    const dir = normalizeDir(config.dataDir || DEFAULT_CONFIG.dataDir);
    return `${dir ? dir + '/' : ''}accounts.json`;
  }

  function getPostsPath(){
    const config = getConfig();
    const dir = normalizeDir(config.dataDir || DEFAULT_CONFIG.dataDir);
    return `${dir ? dir + '/' : ''}posts.json`;
  }

  function getMediaPath(fileName){
    const config = getConfig();
    const dir = normalizeDir(config.mediaDir || DEFAULT_CONFIG.mediaDir);
    return `${dir ? dir + '/' : ''}${fileName}`;
  }

  function buildApiUrl(path, includeRef){
    const config = getConfig();
    const owner = encodeURIComponent(config.owner);
    const repo = encodeURIComponent(config.repo);
    const encodedPath = encodePath(path);
    let url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}`;
    if(includeRef){
      url += `?ref=${encodeURIComponent(config.branch)}`;
    }
    return url;
  }

  function getAuthHeaders(){
    const config = getConfig();
    const headers = {
      Accept: 'application/vnd.github+json'
    };
    if(config.token){
      headers.Authorization = `Bearer ${config.token}`;
    }
    return headers;
  }

  async function request(method, path, body, includeRef){
    if(!isConfigured()){
      throw new Error('Configure GitHub access before performing this action.');
    }

    const url = buildApiUrl(path, method === 'GET' && includeRef);
    const headers = getAuthHeaders();
    const options = { method, headers };

    if(body){
      options.body = JSON.stringify(body);
      options.headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, options);
    if(method === 'GET' && response.status === 404){
      return null;
    }

    let data = null;
    try{
      data = await response.json();
    }catch(err){
      // ignore json parse failure
    }

    if(!response.ok){
      const message = data && data.message ? data.message : `GitHub request failed (${response.status})`;
      throw new Error(message);
    }

    return data;
  }

  function decodeBase64(content){
    if(!content){
      return '';
    }
    try{
      const cleaned = String(content).replace(/\s+/g, '');
      const binary = atob(cleaned);
      const bytes = new Uint8Array(binary.length);
      for(let i = 0; i < binary.length; i += 1){
        bytes[i] = binary.charCodeAt(i);
      }
      return new TextDecoder().decode(bytes);
    }catch(err){
      return '';
    }
  }

  function encodeBase64FromString(value){
    const text = String(value || '');
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    return encodeBase64FromBytes(bytes);
  }

  function encodeBase64FromBytes(bytes){
    if(!(bytes instanceof Uint8Array)){
      bytes = new Uint8Array(bytes || []);
    }
    const chunkSize = 0x8000;
    let binary = '';
    for(let i = 0; i < bytes.length; i += chunkSize){
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, chunk);
    }
    return btoa(binary);
  }

  function sanitizeFileName(name){
    const fallback = 'upload';
    if(!name){
      return fallback;
    }
    return String(name)
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback;
  }

  function createUid(prefix){
    const random = Math.random().toString(36).slice(2, 10);
    const time = Date.now().toString(36);
    return `${prefix || 'id'}_${random}${time}`;
  }

  async function hashPassword(password){
    const text = String(password || '');
    if(window.crypto && window.crypto.subtle && window.TextEncoder){
      const encoded = new TextEncoder().encode(text);
      const buffer = await window.crypto.subtle.digest('SHA-256', encoded);
      const bytes = new Uint8Array(buffer);
      return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    let hash = 0;
    for(let i = 0; i < text.length; i += 1){
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return `fallback-${Math.abs(hash)}`;
  }

  function getActiveAccount(){
    const data = readStorage(KEYS.activeAccount, null);
    if(data && typeof data === 'object'){
      return {
        username: String(data.username || ''),
        email: String(data.email || '')
      };
    }
    return null;
  }

  function setActiveAccount(account){
    if(!account){
      memory.activeAccount = null;
      return writeStorage(KEYS.activeAccount, null);
    }
    const payload = {
      username: String(account.username || ''),
      email: String(account.email || '')
    };
    memory.activeAccount = clone(payload);
    return writeStorage(KEYS.activeAccount, payload);
  }

  function clearActiveAccount(){
    memory.activeAccount = null;
    return writeStorage(KEYS.activeAccount, null);
  }

  async function fetchAccounts(){
    const path = getAccountsPath();
    const result = await request('GET', path, null, true);
    if(!result){
      memory.accountsSha = null;
      return { items: [], sha: null };
    }
    const decoded = decodeBase64(result.content || '');
    let parsed = [];
    try{
      parsed = JSON.parse(decoded);
    }catch(err){
      parsed = [];
    }
    if(!Array.isArray(parsed)){
      parsed = [];
    }
    memory.accountsSha = result.sha || null;
    return { items: parsed, sha: result.sha || null };
  }

  async function saveAccounts(accounts, sha, message){
    const safeAccounts = Array.isArray(accounts) ? accounts : [];
    const json = JSON.stringify(safeAccounts, null, 2) + '\n';
    const content = encodeBase64FromString(json);
    const path = getAccountsPath();
    const body = {
      message: message || 'Update forum accounts',
      content,
      branch: getConfig().branch
    };
    const currentSha = typeof sha === 'string' ? sha : memory.accountsSha;
    if(currentSha){
      body.sha = currentSha;
    }
    const response = await request('PUT', path, body, false);
    const newSha = response && response.content && response.content.sha ? response.content.sha : null;
    memory.accountsSha = newSha;
    return { sha: newSha };
  }

  async function fetchPosts(){
    const path = getPostsPath();
    const result = await request('GET', path, null, true);
    if(!result){
      memory.postsSha = null;
      return { items: [], sha: null };
    }
    const decoded = decodeBase64(result.content || '');
    let parsed = [];
    try{
      parsed = JSON.parse(decoded);
    }catch(err){
      parsed = [];
    }
    if(!Array.isArray(parsed)){
      parsed = [];
    }
    memory.postsSha = result.sha || null;
    return { items: parsed, sha: result.sha || null };
  }

  async function savePosts(posts, sha, message){
    const safePosts = Array.isArray(posts) ? posts : [];
    const json = JSON.stringify(safePosts, null, 2) + '\n';
    const content = encodeBase64FromString(json);
    const path = getPostsPath();
    const body = {
      message: message || 'Update forum posts',
      content,
      branch: getConfig().branch
    };
    const currentSha = typeof sha === 'string' ? sha : memory.postsSha;
    if(currentSha){
      body.sha = currentSha;
    }
    const response = await request('PUT', path, body, false);
    const newSha = response && response.content && response.content.sha ? response.content.sha : null;
    memory.postsSha = newSha;
    return { sha: newSha };
  }

  async function uploadMedia(file){
    if(!(file instanceof File)){
      throw new Error('No media file provided.');
    }
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const encodedContent = encodeBase64FromBytes(bytes);
    const originalName = file.name || 'upload';
    const sanitized = sanitizeFileName(originalName);
    const id = createUid('media');
    const extMatch = sanitized.match(/\.([a-z0-9]+)$/i);
    const extension = extMatch ? extMatch[0].toLowerCase() : '';
    const targetName = `${id}${extension}`;
    const path = getMediaPath(targetName);
    const body = {
      message: `Add community upload ${sanitized}`,
      content: encodedContent,
      branch: getConfig().branch
    };
    const response = await request('PUT', path, body, false);
    const config = getConfig();
    const url = `https://raw.githubusercontent.com/${encodeURIComponent(config.owner)}/${encodeURIComponent(config.repo)}/${encodeURIComponent(config.branch)}/${encodePath(path)}`;
    const sha = response && response.content && response.content.sha ? response.content.sha : null;
    return {
      type: 'file',
      path,
      url,
      originalName,
      mimeType: file.type || '',
      size: file.size || 0,
      sha
    };
  }

  window.communityStorage = {
    hasStorage: () => storageAvailable,
    isConfigured,
    getConfig,
    refreshConfig,
    getActiveAccount,
    setActiveAccount,
    clearActiveAccount,
    fetchAccounts,
    saveAccounts,
    fetchPosts,
    savePosts,
    uploadMedia,
    createUid,
    hashPassword
  };
})();
