const http = require('http');
const { URL } = require('url');
const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(ROOT_DIR, 'data');
const UPLOAD_DIR = path.join(ROOT_DIR, 'uploads', 'forum');
const ACCOUNTS_PATH = path.join(DATA_DIR, 'accounts.json');
const POSTS_PATH = path.join(DATA_DIR, 'posts.json');
const SESSIONS_PATH = path.join(DATA_DIR, 'sessions.json');

const TOKEN_HEADER = 'authorization';
const MAX_BODY_SIZE = 25 * 1024 * 1024; // 25MB payload ceiling for attachments
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20MB per attachment

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.ogg': 'video/ogg',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendError(res, statusCode, message) {
  sendJson(res, statusCode, { message });
}

async function ensureDataFile(filePath, fallback) {
  try {
    await fsp.access(filePath);
  } catch (err) {
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, JSON.stringify(fallback, null, 2));
  }
}

async function readJson(filePath, fallback = []) {
  await ensureDataFile(filePath, fallback);
  const raw = await fsp.readFile(filePath, 'utf8');
  try {
    const parsed = JSON.parse(raw);
    return parsed;
  } catch (err) {
    console.warn(`Failed to parse ${filePath}, resetting.`, err);
    await fsp.writeFile(filePath, JSON.stringify(fallback, null, 2));
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  await fsp.writeFile(filePath, JSON.stringify(data, null, 2));
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function extractToken(req) {
  const header = req.headers[TOKEN_HEADER];
  if (!header) {
    return null;
  }
  const value = Array.isArray(header) ? header[0] : header;
  const parts = String(value).split(' ');
  if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
    return parts[1];
  }
  return parts[0];
}

async function loadSession(token) {
  if (!token) {
    return null;
  }
  const sessions = await readJson(SESSIONS_PATH, []);
  return sessions.find((session) => session && session.token === token) || null;
}

async function persistSession(session) {
  const sessions = await readJson(SESSIONS_PATH, []);
  const filtered = sessions.filter((item) => item && item.token !== session.token);
  filtered.push(session);
  await writeJson(SESSIONS_PATH, filtered);
  return session;
}

async function removeSession(token) {
  if (!token) {
    return;
  }
  const sessions = await readJson(SESSIONS_PATH, []);
  const filtered = sessions.filter((session) => session && session.token !== token);
  await writeJson(SESSIONS_PATH, filtered);
}

async function findAccountByIdentifier(identifier) {
  if (!identifier) {
    return null;
  }
  const accounts = await readJson(ACCOUNTS_PATH, []);
  const lowered = String(identifier).toLowerCase();
  return accounts.find((account) => {
    if (!account) {
      return false;
    }
    return (
      String(account.email || '').toLowerCase() === lowered ||
      String(account.username || '').toLowerCase() === lowered
    );
  }) || null;
}

async function loadAccount(accountId) {
  if (!accountId) {
    return null;
  }
  const accounts = await readJson(ACCOUNTS_PATH, []);
  return accounts.find((account) => account && account.id === accountId) || null;
}

async function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_BODY_SIZE) {
        reject(new Error('payload_too_large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (!chunks.length) {
        resolve('');
      } else {
        resolve(Buffer.concat(chunks).toString('utf8'));
      }
    });

    req.on('error', reject);
  });
}

async function readJsonBody(req, res) {
  let raw = '';
  try {
    raw = await readRequestBody(req);
  } catch (err) {
    if (err && err.message === 'payload_too_large') {
      sendError(res, 413, 'Request body too large.');
    } else {
      sendError(res, 400, 'Unable to read request body.');
    }
    return null;
  }

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (err) {
    sendError(res, 400, 'Request body must be valid JSON.');
    return null;
  }
}

function buildAccountResponse(account) {
  if (!account) {
    return null;
  }
  const { passwordHash, ...publicFields } = account;
  return publicFields;
}

async function handleCreateAccount(req, res) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }

  const { email, username, password } = body;
  if (!email || !username || !password) {
    return sendError(res, 400, 'Email, username, and password are required.');
  }

  const normalizedEmail = String(email).trim();
  const normalizedUsername = String(username).trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return sendError(res, 400, 'Enter a valid email address.');
  }

  if (!/^[A-Za-z0-9_\-]{3,20}$/.test(normalizedUsername)) {
    return sendError(
      res,
      400,
      'Usernames must be 3-20 characters using letters, numbers, underscores, or hyphens.'
    );
  }

  if (String(password).length < 8) {
    return sendError(res, 400, 'Passwords must be at least 8 characters.');
  }

  const accounts = await readJson(ACCOUNTS_PATH, []);
  const emailTaken = accounts.some((account) => account && String(account.email || '').toLowerCase() === normalizedEmail.toLowerCase());
  if (emailTaken) {
    return sendError(res, 409, 'That email is already registered.');
  }

  const usernameTaken = accounts.some((account) => account && String(account.username || '').toLowerCase() === normalizedUsername.toLowerCase());
  if (usernameTaken) {
    return sendError(res, 409, 'That username is already taken.');
  }

  const id = crypto.randomUUID();
  const newAccount = {
    id,
    email: normalizedEmail,
    username: normalizedUsername,
    passwordHash: hashPassword(String(password)),
    createdAt: new Date().toISOString()
  };

  accounts.push(newAccount);
  await writeJson(ACCOUNTS_PATH, accounts);

  const token = crypto.randomBytes(32).toString('hex');
  await persistSession({
    token,
    accountId: id,
    createdAt: new Date().toISOString()
  });

  sendJson(res, 201, {
    account: buildAccountResponse(newAccount),
    token
  });
}

async function handleSignIn(req, res) {
  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }

  const { identifier, password } = body;
  if (!identifier || !password) {
    return sendError(res, 400, 'Enter your email or username and password.');
  }

  const account = await findAccountByIdentifier(identifier);
  if (!account) {
    return sendError(res, 401, 'Account not found.');
  }

  const submittedHash = hashPassword(String(password));
  if (submittedHash !== account.passwordHash) {
    return sendError(res, 401, 'Incorrect password.');
  }

  const token = crypto.randomBytes(32).toString('hex');
  await persistSession({
    token,
    accountId: account.id,
    createdAt: new Date().toISOString()
  });

  sendJson(res, 200, {
    account: buildAccountResponse(account),
    token
  });
}

async function handleSignOut(req, res) {
  const body = await readJsonBody(req, res);
  if (body === null) {
    return;
  }

  const token = extractToken(req) || (body && body.token);
  if (!token) {
    return sendError(res, 400, 'Missing session token.');
  }

  await removeSession(token);
  res.writeHead(204).end();
}

async function handleSession(req, res) {
  const token = extractToken(req);
  if (!token) {
    return sendError(res, 401, 'Not signed in.');
  }

  const session = await loadSession(token);
  if (!session) {
    return sendError(res, 401, 'Session expired.');
  }

  const account = await loadAccount(session.accountId);
  if (!account) {
    await removeSession(token);
    return sendError(res, 401, 'Account no longer exists.');
  }

  sendJson(res, 200, { account: buildAccountResponse(account) });
}

async function handleGetPosts(_req, res) {
  const posts = await readJson(POSTS_PATH, []);
  posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  sendJson(res, 200, { posts });
}

function parseDataUrl(dataUrl) {
  if (!dataUrl) {
    return null;
  }
  const match = /^data:([^;]+);base64,(.+)$/i.exec(String(dataUrl));
  if (!match) {
    return null;
  }
  const mimeType = match[1];
  const base64 = match[2];
  try {
    const buffer = Buffer.from(base64, 'base64');
    return { buffer, mimeType };
  } catch (err) {
    return null;
  }
}

async function handleCreatePost(req, res) {
  const token = extractToken(req);
  if (!token) {
    // still read body to avoid client reset errors
    const skipBody = await readJsonBody(req, res);
    if (skipBody === null) {
      return;
    }
    return sendError(res, 401, 'Sign in required.');
  }

  const session = await loadSession(token);
  if (!session) {
    const skipBody = await readJsonBody(req, res);
    if (skipBody === null) {
      return;
    }
    return sendError(res, 401, 'Session expired.');
  }

  const account = await loadAccount(session.accountId);
  if (!account) {
    await removeSession(token);
    const skipBody = await readJsonBody(req, res);
    if (skipBody === null) {
      return;
    }
    return sendError(res, 401, 'Account not found.');
  }

  const body = await readJsonBody(req, res);
  if (!body) {
    return;
  }

  const { title, body: messageBody, details, category, mediaLink, mediaUpload } = body;
  const contentTitle = title ?? '';
  const contentBody = messageBody ?? details ?? '';

  const trimmedTitle = String(contentTitle).trim();
  const trimmedBody = String(contentBody).trim();

  if (!trimmedTitle || !trimmedBody) {
    return sendError(res, 400, 'Title and details are required.');
  }

  const post = {
    id: crypto.randomUUID(),
    accountId: account.id,
    authorName: account.username,
    title: trimmedTitle.slice(0, 200),
    body: trimmedBody.slice(0, 5000),
    category: String(category || 'General').trim() || 'General',
    createdAt: new Date().toISOString(),
    media: null
  };

  if (mediaUpload && mediaUpload.dataUrl) {
    const parsed = parseDataUrl(mediaUpload.dataUrl);
    if (!parsed) {
      return sendError(res, 400, 'Invalid media upload.');
    }
    if (parsed.buffer.length > MAX_UPLOAD_SIZE) {
      return sendError(res, 413, 'Attachments must be 20MB or smaller.');
    }
    const originalName = String(mediaUpload.name || 'upload').replace(/[^a-zA-Z0-9_.-]/g, '-');
    const mimeType = mediaUpload.type || parsed.mimeType || 'application/octet-stream';
    const fileName = `${Date.now()}-${crypto.randomUUID()}-${originalName || 'attachment'}`;
    await fsp.mkdir(UPLOAD_DIR, { recursive: true });
    const filePath = path.join(UPLOAD_DIR, fileName);
    await fsp.writeFile(filePath, parsed.buffer);
    post.media = {
      type: 'file',
      url: `/uploads/forum/${fileName}`,
      originalName: mediaUpload.name || originalName || 'attachment',
      mimeType
    };
  } else if (mediaLink) {
    const trimmed = String(mediaLink).trim();
    if (trimmed) {
      post.media = {
        type: 'link',
        url: trimmed
      };
    }
  }

  const posts = await readJson(POSTS_PATH, []);
  posts.push(post);
  await writeJson(POSTS_PATH, posts);

  sendJson(res, 201, { post });
}

async function handleApiRequest(req, res, pathname) {
  try {
    if (req.method === 'POST' && pathname === '/api/accounts') {
      return await handleCreateAccount(req, res);
    }
    if (req.method === 'POST' && pathname === '/api/auth/signin') {
      return await handleSignIn(req, res);
    }
    if (req.method === 'POST' && pathname === '/api/auth/signout') {
      return await handleSignOut(req, res);
    }
    if (req.method === 'GET' && pathname === '/api/auth/session') {
      return await handleSession(req, res);
    }
    if (req.method === 'GET' && pathname === '/api/posts') {
      return await handleGetPosts(req, res);
    }
    if (req.method === 'POST' && pathname === '/api/posts') {
      return await handleCreatePost(req, res);
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ message: 'Not found.' }));
  } catch (err) {
    console.error('API error', err);
    if (!res.headersSent) {
      sendError(res, 500, 'Unexpected server error.');
    } else {
      res.end();
    }
  }
}

async function serveStatic(req, res, pathname) {
  const decodedPath = decodeURIComponent(pathname);
  const normalizedPath = path.normalize(decodedPath).replace(/^\.\/+/, '');
  let filePath = path.join(ROOT_DIR, normalizedPath);

  if (!filePath.startsWith(ROOT_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  try {
    const stats = await fsp.stat(filePath).catch(async (err) => {
      if (err.code === 'ENOENT') {
        return null;
      }
      throw err;
    });

    if (!stats) {
      // try directory index
      filePath = path.join(filePath, 'index.html');
      const indexStats = await fsp.stat(filePath).catch(() => null);
      if (!indexStats) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
    } else if (stats.isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    const stream = fs.createReadStream(filePath);

    stream.on('open', () => {
      res.writeHead(200, {
        'Content-Type': mime,
        'Cache-Control': 'no-cache'
      });
    });

    stream.on('error', (err) => {
      console.error('Static file error', err);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end('Internal Server Error');
    });

    stream.pipe(res);
  } catch (err) {
    console.error('Static handler error', err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end('Internal Server Error');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const { pathname } = url;

  if (pathname.startsWith('/api/')) {
    return handleApiRequest(req, res, pathname);
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  await serveStatic(req, res, pathname === '/' ? '/index.html' : pathname);
});

server.listen(PORT, () => {
  console.log(`Extynct Studios server running on http://localhost:${PORT}`);
});
