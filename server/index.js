const path = require('path');
const express = require('express');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

const credentialPairs = (process.env.LOGIN_CREDENTIALS || 'admin:password').split(',');
const credentials = new Map(
  credentialPairs
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [username, password] = pair.split(':');
      if (!username || typeof password === 'undefined') {
        return null;
      }
      return [username, password];
    })
    .filter(Boolean)
);

const redirectUrl = process.env.LOGIN_REDIRECT_URL || '/';

app.use(express.json());

app.post('/api/login', (req, res, next) => {
  try {
    const { username, password } = req.body || {};

    if (!username || !password) {
      return res
        .status(400)
        .json({ message: 'Username and password are required.' });
    }

    const expectedPassword = credentials.get(username);
    if (!expectedPassword || expectedPassword !== password) {
      return res
        .status(401)
        .json({ message: 'Incorrect username or password. Please try again.' });
    }

    return res.json({
      token: `mock-token-${Buffer.from(username).toString('hex')}`,
      redirectUrl,
    });
  } catch (error) {
    return next(error);
  }
});

app.use(
  express.static(path.resolve(__dirname, '..'), {
    extensions: ['html'],
    fallthrough: true,
  })
);

app.use((req, res, next) => {
  if (req.method === 'GET') {
    return res.sendFile(path.resolve(__dirname, '..', 'index.html'));
  }
  return next();
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ message: 'An unexpected error occurred.' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
