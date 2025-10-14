(function(){
  const KEYS = {
    accounts: 'extynct.accounts',
    activeAccount: 'extynct.activeAccount',
    posts: 'extynct.posts'
  };

  const memory = {};

  function hasNativeStorage(){
    try{
      const testKey = '__extynct_test__';
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    }catch(err){
      return false;
    }
  }

  const storageSupported = hasNativeStorage();

  function cloneValue(value){
    if(typeof structuredClone === 'function'){
      try{
        return structuredClone(value);
      }catch(err){
        // fall through to manual clone
      }
    }

    if(Array.isArray(value)){
      return value.map((item) => cloneValue(item));
    }
    if(value && typeof value === 'object'){
      const cloned = {};
      for(const key in value){
        if(Object.prototype.hasOwnProperty.call(value, key)){
          cloned[key] = cloneValue(value[key]);
        }
      }
      return cloned;
    }
    return value;
  }

  function read(key, fallback){
    if(Object.prototype.hasOwnProperty.call(memory, key)){
      return cloneValue(memory[key]);
    }

    let value = fallback;
    if(storageSupported){
      try{
        const raw = localStorage.getItem(key);
        if(raw !== null){
          value = JSON.parse(raw);
        }
      }catch(err){
        value = fallback;
      }
    }

    memory[key] = value;
    return cloneValue(value);
  }

  function write(key, value){
    memory[key] = cloneValue(value);

    if(!storageSupported){
      return false;
    }

    try{
      if(value === undefined || value === null){
        localStorage.removeItem(key);
      }else{
        localStorage.setItem(key, JSON.stringify(value));
      }
      return true;
    }catch(err){
      return false;
    }
  }

  async function hashPassword(password){
    const text = String(password || '');
    if(window.crypto && window.crypto.subtle && window.TextEncoder){
      const encoded = new TextEncoder().encode(text);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', encoded);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    let hash = 0;
    for(let i = 0; i < text.length; i += 1){
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return `fallback-${Math.abs(hash)}`;
  }

  function createUid(prefix){
    const random = Math.random().toString(36).slice(2, 10);
    const time = Date.now().toString(36);
    return `${prefix || 'id'}_${random}${time}`;
  }

  function getAccounts(){
    const accounts = read(KEYS.accounts, []);
    return Array.isArray(accounts) ? accounts : [];
  }

  function saveAccounts(accounts){
    const safe = Array.isArray(accounts) ? accounts : [];
    return write(KEYS.accounts, safe);
  }

  function getActiveAccount(){
    const account = read(KEYS.activeAccount, null);
    if(account && typeof account === 'object'){
      return {
        username: String(account.username || ''),
        email: String(account.email || '')
      };
    }
    return null;
  }

  function setActiveAccount(account){
    if(!account){
      return write(KEYS.activeAccount, null);
    }
    const payload = {
      username: String(account.username || ''),
      email: String(account.email || '')
    };
    return write(KEYS.activeAccount, payload);
  }

  function clearActiveAccount(){
    return write(KEYS.activeAccount, null);
  }

  function getPosts(){
    const posts = read(KEYS.posts, []);
    return Array.isArray(posts) ? posts : [];
  }

  function savePosts(posts){
    const safe = Array.isArray(posts) ? posts : [];
    return write(KEYS.posts, safe);
  }

  window.communityStorage = {
    hasStorage: () => storageSupported,
    getAccounts,
    saveAccounts,
    getActiveAccount,
    setActiveAccount,
    clearActiveAccount,
    getPosts,
    savePosts,
    createUid,
    hashPassword
  };
})();
