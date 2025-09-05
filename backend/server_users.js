// server_users.js

// --- 1. Import Dependencies ---
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');

// --- 2. Initialize the Express App ---
const app = express();
const PORT = 3002;

// --- 3. Configuration ---
const EXTERNAL_API_BASE = 'http://goatedcodoer:8080/api';
const SESSIONS = new Map();
const SESSION_COOKIE = 'vos_sid';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

// --- 4. Middleware ---
const ALLOWED_ORIGINS = [
    'http://localhost:3002',
    'http://localhost:63342',
    'http://127.0.0.1:63342'
];
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }
        return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json());

const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

app.get('/', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// --- Helper Functions (parseCookies, etc. - unchanged) ---
function parseCookies(req) {
    const header = req.headers['cookie'];
    const out = {};
    if (!header) return out;
    header.split(';').forEach(pair => {
        const idx = pair.indexOf('=');
        if (idx > -1) {
            const k = pair.slice(0, idx).trim();
            const v = decodeURIComponent(pair.slice(idx + 1).trim());
            out[k] = v;
        }
    });
    return out;
}

function setSessionCookie(res, token) {
    res.cookie(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/',
        maxAge: SESSION_TTL_MS
    });
}

function getSessionUser(req) {
    const cookies = parseCookies(req);
    const token = cookies[SESSION_COOKIE];
    if (!token) return null;
    const entry = SESSIONS.get(token);
    if (!entry) return null;
    const { user, expiresAt } = entry;
    if (Date.now() > expiresAt) {
        SESSIONS.delete(token);
        return null;
    }
    return user;
}


// --- 5. API Routes ---

const serveAddressFile = (fileName, res) => {
    const filePath = path.join(__dirname, '..', 'data', fileName);
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error(`Error reading ${fileName}:`, err);
            return res.status(500).json({ message: `Could not load ${fileName}.` });
        }
        res.setHeader('Content-Type', 'application/json');
        res.send(data);
    });
};

app.get('/api/provinces', (req, res) => {
    serveAddressFile('province.json', res);
});
app.get('/api/cities', (req, res) => {
    serveAddressFile('city.json', res);
});
app.get('/api/barangays', (req, res) => {
    serveAddressFile('barangay.json', res);
});


/**
 * @route   GET /api/users
 * @desc    Acts as a proxy to fetch all users from the external API.
 */
app.get('/api/users', async (req, res) => {
    try {
        // FIX: Added a 10-second timeout to prevent the server from hanging indefinitely.
        const { data } = await axios.get(`${EXTERNAL_API_BASE}/users`, { timeout: 10000 });
        res.json(data);
    } catch (err) {
        console.error('GET /api/users proxy error:', err.message);
        res.status(500).json({ message: 'Failed to fetch users: The external API is not responding.' });
    }
});

// --- Other API Routes (login, auth, departments, etc. - unchanged) ---
app.post('/api/login', async (req, res) => {
    try {
        const body = req.body || {};
        const email = body.email || body.username || body.user_email;
        const password = body.password || body.user_password;
        if (!email || !password) {
            return res.status(400).json({ ok: false, message: 'Email/username and password are required.' });
        }
        const { data: users } = await axios.get(`${EXTERNAL_API_BASE}/users`, { timeout: 10000 });
        const list = Array.isArray(users) ? users : [];
        const user = list.find(u => u.email === email);
        if (!user || String(password) !== String(user.password)) {
            return res.status(401).json({ ok: false, message: 'Invalid credentials.' });
        }
        const token = crypto.randomBytes(24).toString('hex');
        SESSIONS.set(token, { user: { id: user.id, email: user.email, name: user.name || user.fullName || user.email }, expiresAt: Date.now() + SESSION_TTL_MS });
        setSessionCookie(res, token);
        return res.json({ ok: true, message: 'Login successful', user: { id: user.id, email: user.email, name: user.name || user.fullName || user.email } });
    } catch (err) {
        console.error('Login error:', err.message);
        return res.status(500).json({ ok: false, message: 'Could not connect to the authentication service.' });
    }
});
app.get('/api/auth/current-login', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ ok: false, message: 'Not authenticated' });
    return res.json({ ok: true, user });
});
app.post('/api/users', async (req, res) => {
    try {
        const { data } = await axios.post(`${EXTERNAL_API_BASE}/users`, req.body, { timeout: 10000 });
        res.status(201).json(data);
    } catch (err) {
        console.error('POST /api/users proxy error:', err.message);
        const status = err.response?.status || 500;
        const message = err.response?.data?.message || 'Failed to create user via the external API.';
        res.status(status).json({ message });
    }
});
app.put('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data } = await axios.put(`${EXTERNAL_API_BASE}/users/${id}`, req.body, { timeout: 10000 });
        res.json(data);
    } catch (err) {
        console.error('PUT /api/users/:id proxy error:', err.message);
        const status = err.response?.status || 500;
        const message = err.response?.data?.message || 'Failed to update user via the external API.';
        res.status(status).json({ message });
    }
});
app.get('/api/departments', async (req, res) => {
    try {
        const { data } = await axios.get(`${EXTERNAL_API_BASE}/departments`, { timeout: 10000 });
        res.json(data);
    } catch (err) {
        console.error('GET /api/departments proxy error:', err.message);
        res.status(500).json({ message: 'Failed to fetch departments from the external API.' });
    }
});


// --- 6. Start the Server ---
app.listen(PORT, () => {
    console.log('--------------------------------------');
    console.log(`🚀 Advanced Server is running!`);
    console.log(`✅ Front-end served at: http://localhost:${PORT}`);
    console.log(`✅ API requests are being proxied to: ${EXTERNAL_API_BASE}`);
    console.log('--------------------------------------');
})