(function(){
  const CONFIG_KEY = 'extynct.repo.config';
  const TOKEN_KEY = 'extynct.repo.token';
  const ACCOUNT_KEY = 'extynct.activeAccount';

  const storageAvailable = (() => {
    try {
      const probe = '__repo_storage_probe__';
      localStorage.setItem(probe, '1');
      localStorage.removeItem(probe);
      return true;
    } catch (err) {
      return false;
    }
  })();

  function safeGet(key){
    if(!storageAvailable){
      return null;
    }
    try {
      return localStorage.getItem(key);
    } catch (err) {
      return null;
    }
  }

  function safeSet(key, value){
    if(!storageAvailable){
      return false;
    }
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (err) {
      return false;
    }
  }

  function safeRemove(key){
    if(!storageAvailable){
      return false;
    }
    try {
      localStorage.removeItem(key);
      return true;
    } catch (err) {
      return false;
    }
  }

  function readDatasetConfig(root){
    if(!root){
      return {};
    }
    const owner = root.getAttribute('data-owner') || '';
    const repo = root.getAttribute('data-repo') || '';
    const branch = root.getAttribute('data-branch') || 'main';
    return { owner, repo, branch };
  }

  function getStoredConfig(){
    const raw = safeGet(CONFIG_KEY);
    if(!raw){
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch (err) {
      return null;
    }
  }

  function storeConfig(config){
    if(!config){
      return false;
    }
    return safeSet(CONFIG_KEY, JSON.stringify(config));
  }

  function getTokenValue(){
    return safeGet(TOKEN_KEY) || '';
  }

  function mergeConfig(defaults, override){
    return {
      owner: (override && override.owner) || defaults.owner || '',
      repo: (override && override.repo) || defaults.repo || '',
      branch: (override && override.branch) || defaults.branch || 'main'
    };
  }

  function deepClone(data){
    if(data === undefined){
      return data;
    }
    return JSON.parse(JSON.stringify(data));
  }

  function ensureConfig(config){
    if(!config.owner || !config.repo){
      throw new Error('Repository owner and name are not configured yet.');
    }
    if(!config.branch){
      config.branch = 'main';
    }
    return config;
  }

  function buildRawUrl(config, path){
    return `https://raw.githubusercontent.com/${config.owner}/${config.repo}/${config.branch}/${path}`;
  }

  function buildContentsUrl(config, path){
    return `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${path}`;
  }

  function authHeaders(token){
    const headers = { 'Accept': 'application/vnd.github+json' };
    if(token){
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  function base64ToText(base64){
    const clean = (base64 || '').replace(/\s+/g, '');
    if(!clean){
      return '';
    }
    const binary = atob(clean);
    const bytes = new Uint8Array(binary.length);
    for(let i = 0; i < binary.length; i += 1){
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  }

  function textToBase64(text){
    const encoder = new TextEncoder();
    const bytes = encoder.encode(text);
    let binary = '';
    const chunkSize = 0x8000;
    for(let i = 0; i < bytes.length; i += chunkSize){
      const chunk = bytes.subarray(i, i + chunkSize);
      binary += String.fromCharCode.apply(null, Array.from(chunk));
    }
    return btoa(binary);
  }

  function readFileAsBase64(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if(typeof result !== 'string'){
          reject(new Error('Unsupported file result.'));
          return;
        }
        const commaIndex = result.indexOf(',');
        const base64 = commaIndex >= 0 ? result.slice(commaIndex + 1) : result;
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error || new Error('Unable to read file.'));
      reader.readAsDataURL(file);
    });
  }

  async function fetchJson(config, path, fallback){
    const resolved = ensureConfig(config);
    const url = `${buildRawUrl(resolved, path)}?cache=${Date.now()}`;
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if(!response.ok){
        return deepClone(fallback);
      }
      const text = await response.text();
      if(!text.trim()){
        return deepClone(fallback);
      }
      return JSON.parse(text);
    } catch (err) {
      console.error('Failed to fetch repository JSON', err);
      return deepClone(fallback);
    }
  }

  async function fetchContents(config, path, token){
    const resolved = ensureConfig(config);
    const url = `${buildContentsUrl(resolved, path)}?ref=${encodeURIComponent(resolved.branch)}`;
    const response = await fetch(url, { headers: authHeaders(token) });
    if(response.status === 404){
      return null;
    }
    if(!response.ok){
      const errorText = await response.text();
      throw new Error(`GitHub contents request failed (${response.status}): ${errorText}`);
    }
    return response.json();
  }

  async function updateJson(config, path, updater, message, fallback){
    const resolved = ensureConfig(config);
    const token = getTokenValue();
    if(!token){
      throw new Error('A GitHub personal access token is required to save changes.');
    }

    const existing = await fetchContents(resolved, path, token);
    let currentData = deepClone(fallback);
    let sha;

    if(existing){
      sha = existing.sha;
      try {
        const decoded = base64ToText(existing.content || '');
        if(decoded.trim()){
          currentData = JSON.parse(decoded);
        }
      } catch (err) {
        console.warn(`Failed to parse existing ${path}; starting from fallback.`, err);
      }
    }

    const updatedData = updater(deepClone(currentData));
    if(updatedData === undefined){
      throw new Error('Updater did not return data to write.');
    }

    const jsonText = `${JSON.stringify(updatedData, null, 2)}\n`;
    const body = {
      message,
      content: textToBase64(jsonText),
      branch: resolved.branch
    };
    if(sha){
      body.sha = sha;
    }

    const putResponse = await fetch(buildContentsUrl(resolved, path), {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders(token)),
      body: JSON.stringify(body)
    });

    if(!putResponse.ok){
      let details = '';
      try {
        const payload = await putResponse.json();
        details = payload && payload.message ? ` ${payload.message}` : '';
      } catch (err) {
        const text = await putResponse.text();
        details = text ? ` ${text}` : '';
      }
      throw new Error(`GitHub update failed (${putResponse.status}).${details}`);
    }

    return deepClone(updatedData);
  }

  async function uploadFile(config, path, file, message){
    const resolved = ensureConfig(config);
    const token = getTokenValue();
    if(!token){
      throw new Error('A GitHub personal access token is required to upload files.');
    }

    const base64 = await readFileAsBase64(file);
    const body = {
      message,
      content: base64,
      branch: resolved.branch
    };

    const response = await fetch(buildContentsUrl(resolved, path), {
      method: 'PUT',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authHeaders(token)),
      body: JSON.stringify(body)
    });

    if(!response.ok){
      let messageDetail = '';
      try {
        const payload = await response.json();
        messageDetail = payload && payload.message ? ` ${payload.message}` : '';
      } catch (err) {
        const text = await response.text();
        messageDetail = text ? ` ${text}` : '';
      }
      throw new Error(`Upload failed (${response.status}).${messageDetail}`);
    }

    return {
      path,
      url: `/${path}`,
      rawUrl: `${buildRawUrl(resolved, path)}?cache=${Date.now()}`
    };
  }

  function slugifyFileName(name){
    const trimmed = (name || '').trim();
    const lastDot = trimmed.lastIndexOf('.');
    const base = lastDot > 0 ? trimmed.slice(0, lastDot) : trimmed;
    const ext = lastDot > 0 ? trimmed.slice(lastDot).toLowerCase() : '';
    const safeBase = base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'file';
    return `${safeBase}${ext}`;
  }

  function createUid(prefix){
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    return prefix ? `${prefix}-${id}` : id;
  }

  async function hashPassword(password){
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  function createClient(root){
    const defaults = readDatasetConfig(root);
    return {
      hasStorage: () => storageAvailable,
      getConfig(){
        const stored = getStoredConfig();
        return mergeConfig(defaults, stored || {});
      },
      setConfig(newConfig){
        const merged = mergeConfig(defaults, newConfig || {});
        storeConfig({ owner: merged.owner, repo: merged.repo, branch: merged.branch });
        return merged;
      },
      clearConfig(){
        safeRemove(CONFIG_KEY);
      },
      getToken: getTokenValue,
      setToken(token){
        if(!token){
          return safeRemove(TOKEN_KEY);
        }
        return safeSet(TOKEN_KEY, token);
      },
      hasToken(){
        return Boolean(getTokenValue());
      },
      clearToken(){
        return safeRemove(TOKEN_KEY);
      },
      fetchJson(path, fallback){
        const config = this.getConfig();
        return fetchJson(config, path, fallback);
      },
      updateJson(path, updater, message, fallback){
        const config = this.getConfig();
        return updateJson(config, path, updater, message, fallback);
      },
      uploadFile(path, file, message){
        const config = this.getConfig();
        return uploadFile(config, path, file, message);
      },
      slugifyFileName,
      createUid,
      getActiveAccount(){
        const raw = safeGet(ACCOUNT_KEY);
        if(!raw){
          return null;
        }
        try {
          return JSON.parse(raw);
        } catch (err) {
          return null;
        }
      },
      setActiveAccount(account){
        if(!account){
          return this.clearActiveAccount();
        }
        return safeSet(ACCOUNT_KEY, JSON.stringify(account));
      },
      clearActiveAccount(){
        return safeRemove(ACCOUNT_KEY);
      }
    };
  }

  window.repoStorage = {
    createClient,
    hashPassword,
    slugifyFileName,
    createUid
  };
})();
