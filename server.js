const express = require('express');
const path = require('path');
const fs = require('fs/promises');
const crypto = require('crypto');
const multer = require('multer');

const app = express();
const PORT = process.env.PORT || 3000;

const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(__dirname, 'uploads', 'forum');
const ACCOUNTS_PATH = path.join(DATA_DIR, 'accounts.json');
const POSTS_PATH = path.join(DATA_DIR, 'posts.json');
const SESSIONS_PATH = path.join(DATA_DIR, 'sessions.json');

const TOKEN_HEADER = 'authorization';

const upload = multer({
  storage: multer.diskStorage({
    destination: async (req, file, cb) => {
      try {
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
        cb(null, UPLOAD_DIR);
      } catch (err) {
        cb(err, UPLOAD_DIR);
      }
    },
    filename: (req, file, cb) => {
      const safeName = file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '-');
      const stamp = Date.now();
      cb(null, `${stamp}-${safeName}`);
    }
  }),
  limits: {
    fileSize: 20 * 1024 * 1024
  }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(__dirname));

async function ensureDataFile(filePath, fallback) {
  try {
    await fs.access(filePath);
  } catch (err) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(fallback, null, 2));
  }
}

async function readJson(filePath) {
  await ensureDataFile(filePath, []);
  const raw = await fs.readFile(filePath, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`Failed to parse ${filePath}, resetting.`, err);
    await fs.writeFile(filePath, JSON.stringify([], null, 2));
    return [];
  }
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function buildAccountResponse(account) {
  if (!account) {
    return null;
  }
  const { passwordHash, ...publicFields } = account;
  return publicFields;
}

function extractToken(req) {
  const header = req.get(TOKEN_HEADER);
  if (!header) {
    return null;
  }
  const parts = header.split(' ');
  if (parts.length === 2 && /^bearer$/i.test(parts[0])) {
    return parts[1];
  }
  return parts[0];
}

async function loadSession(token) {
  if (!token) {
    return null;
  }
  const sessions = await readJson(SESSIONS_PATH);
  return sessions.find((session) => session && session.token === token) || null;
}

async function persistSession(session) {
  const sessions = await readJson(SESSIONS_PATH);
  const filtered = sessions.filter((item) => item && item.token !== session.token);
  filtered.push(session);
  await writeJson(SESSIONS_PATH, filtered);
  return session;
}

async function removeSession(token) {
  if (!token) {
    return;
  }
  const sessions = await readJson(SESSIONS_PATH);
  const filtered = sessions.filter((session) => session && session.token !== token);
  await writeJson(SESSIONS_PATH, filtered);
}

async function findAccountByIdentifier(identifier) {
  const accounts = await readJson(ACCOUNTS_PATH);
  const lowered = String(identifier || '').toLowerCase();
  return accounts.find((account) => {
    if (!account) {
      return false;
    }
    return account.email.toLowerCase() === lowered || account.username.toLowerCase() === lowered;
  }) || null;
}

async function loadAccount(accountId) {
  if (!accountId) {
    return null;
  }
  const accounts = await readJson(ACCOUNTS_PATH);
  return accounts.find((account) => account && account.id === accountId) || null;
}

app.post('/api/accounts', async (req, res) => {
  const { email, username, password } = req.body || {};
  if (!email || !username || !password) {
    return res.status(400).json({ message: 'Email, username, and password are required.' });
  }

  const normalizedEmail = String(email).trim();
  const normalizedUsername = String(username).trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }

  if (!/^[A-Za-z0-9_\-]{3,20}$/.test(normalizedUsername)) {
    return res.status(400).json({ message: 'Usernames must be 3-20 characters using letters, numbers, underscores, or hyphens.' });
  }

  if (String(password).length < 8) {
    return res.status(400).json({ message: 'Passwords must be at least 8 characters.' });
  }

  const accounts = await readJson(ACCOUNTS_PATH);

  const emailTaken = accounts.some((account) => account && account.email.toLowerCase() === normalizedEmail.toLowerCase());
  if (emailTaken) {
    return res.status(409).json({ message: 'That email is already registered.' });
  }

  const usernameTaken = accounts.some((account) => account && account.username.toLowerCase() === normalizedUsername.toLowerCase());
  if (usernameTaken) {
    return res.status(409).json({ message: 'That username is already taken.' });
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

  res.status(201).json({
    account: buildAccountResponse(newAccount),
    token
  });
});

app.post('/api/auth/signin', async (req, res) => {
  const { identifier, password } = req.body || {};
  if (!identifier || !password) {
    return res.status(400).json({ message: 'Enter your email or username and password.' });
  }

  const account = await findAccountByIdentifier(identifier);
  if (!account) {
    return res.status(401).json({ message: 'Account not found.' });
  }

  const submittedHash = hashPassword(String(password));
  if (submittedHash !== account.passwordHash) {
    return res.status(401).json({ message: 'Incorrect password.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  await persistSession({
    token,
    accountId: account.id,
    createdAt: new Date().toISOString()
  });

  res.json({
    account: buildAccountResponse(account),
    token
  });
});

app.post('/api/auth/signout', async (req, res) => {
  const token = extractToken(req) || (req.body && req.body.token);
  if (!token) {
    return res.status(400).json({ message: 'Missing session token.' });
  }
  await removeSession(token);
  res.status(204).end();
});

app.get('/api/auth/session', async (req, res) => {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ message: 'Not signed in.' });
  }

  const session = await loadSession(token);
  if (!session) {
    return res.status(401).json({ message: 'Session expired.' });
  }

  const account = await loadAccount(session.accountId);
  if (!account) {
    await removeSession(token);
    return res.status(401).json({ message: 'Account no longer exists.' });
  }

  res.json({ account: buildAccountResponse(account) });
});

app.get('/api/posts', async (req, res) => {
  const posts = await readJson(POSTS_PATH);
  posts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ posts });
});

app.post('/api/posts', upload.single('mediaFile'), async (req, res) => {
  const token = extractToken(req) || (req.body && req.body.token);
  if (!token) {
    if (req.file) {
      await fs.rm(req.file.path, { force: true });
    }
    return res.status(401).json({ message: 'Sign in required.' });
  }

  const session = await loadSession(token);
  if (!session) {
    if (req.file) {
      await fs.rm(req.file.path, { force: true });
    }
    return res.status(401).json({ message: 'Session expired.' });
  }

  const account = await loadAccount(session.accountId);
  if (!account) {
    await removeSession(token);
    if (req.file) {
      await fs.rm(req.file.path, { force: true });
    }
    return res.status(401).json({ message: 'Account not found.' });
  }

  const { title, body, category, mediaLink } = req.body || {};
  if (!title || !body) {
    if (req.file) {
      await fs.rm(req.file.path, { force: true });
    }
    return res.status(400).json({ message: 'Title and details are required.' });
  }

  const post = {
    id: crypto.randomUUID(),
    accountId: account.id,
    authorName: account.username,
    title: String(title).trim().slice(0, 200),
    body: String(body).trim().slice(0, 5000),
    category: String(category || 'General').trim() || 'General',
    createdAt: new Date().toISOString(),
    media: null
  };

  if (req.file) {
    post.media = {
      type: 'file',
      url: `/uploads/forum/${path.basename(req.file.path)}`,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype
    };
  } else if (mediaLink) {
    post.media = {
      type: 'link',
      url: String(mediaLink).trim()
    };
  }

  const posts = await readJson(POSTS_PATH);
  posts.push(post);
  await writeJson(POSTS_PATH, posts);

  res.status(201).json({ post });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'Unexpected server error.' });
});

app.listen(PORT, () => {
  console.log(`Extynct Studios server running on http://localhost:${PORT}`);
});
