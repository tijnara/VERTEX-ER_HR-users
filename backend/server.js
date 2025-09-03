// server.js

// --- 1. Import Dependencies ---
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios'); // For making HTTP requests to the external API
const crypto = require('crypto');

// --- 2. Initialize the Express App ---
const app = express();
const PORT = 3002; // The port this server will run on.

// --- 3. Configuration ---
// The base URL of your actual, external API
const EXTERNAL_API_BASE = 'http://goatedcodoer:8080/api';

// Simple in-memory session store (token -> user)
const SESSIONS = new Map();
const SESSION_COOKIE = 'vos_sid';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

// --- 4. Middleware ---
// Configure CORS to allow credentials and specific origins (no wildcard when using credentials)
const ALLOWED_ORIGINS = [
    'http://localhost:3002',
    'http://localhost:63342',
    'http://127.0.0.1:63342'
];
const corsOptions = {
    origin: function (origin, callback) {
        // Allow non-browser requests (no origin) and approved origins
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }
        return callback(null, false);
    },
    credentials: true
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
app.use(express.json()); // Enable the express app to parse JSON formatted request bodies

// Serve static files (HTML, CSS, JS) from the frontend directory
const FRONTEND_DIR = path.join(__dirname, '..', 'frontend');
app.use(express.static(FRONTEND_DIR));

// Serve index.html at root for convenience
app.get('/', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

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
    // Note: This app is served over http, so Secure cannot be true. SameSite=Lax is ok for same-origin.
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

/**
 * @route   POST /api/login
 * @desc    Handles user login by validating credentials against the external API.
 *          Also sets a session cookie for subsequent authenticated requests.
 */
app.post('/api/login', async (req, res) => {
    try {
        // Accept multiple payload shapes from different clients
        const body = req.body || {};
        const email = body.email || body.username || body.user_email;
        const password = body.password || body.user_password;

        if (!email || !password) {
            return res.status(400).json({ ok: false, message: 'Email/username and password are required.' });
        }

        // Fetch all users from the external API to validate credentials
        const { data: users } = await axios.get(`${EXTERNAL_API_BASE}/users`);
        const list = Array.isArray(users) ? users : [];
        const user = list.find(u => u.email === email);

        if (!user) {
            return res.status(401).json({ ok: false, message: 'Invalid credentials.' });
        }

        // IMPORTANT: In a real-world scenario, verify password server-side securely.
        if (String(password) !== String(user.password)) {
            return res.status(401).json({ ok: false, message: 'Invalid credentials.' });
        }

        // Create a session and set cookie
        const token = crypto.randomBytes(24).toString('hex');
        SESSIONS.set(token, { user: { id: user.id, email: user.email, name: user.name || user.fullName || user.email }, expiresAt: Date.now() + SESSION_TTL_MS });
        setSessionCookie(res, token);

        return res.json({ ok: true, message: 'Login successful', user: { id: user.id, email: user.email, name: user.name || user.fullName || user.email } });

    } catch (err) {
        console.error('Login error:', err.message);
        return res.status(500).json({ ok: false, message: 'Could not connect to the authentication service.' });
    }
});

/**
 * @route   GET /api/auth/current-login
 * @desc    Returns the current authenticated user based on the session cookie.
 */
app.get('/api/auth/current-login', async (req, res) => {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ ok: false, message: 'Not authenticated' });
    return res.json({ ok: true, user });
});

/**
 * @route   GET /api/users
 * @desc    Acts as a proxy to fetch all users from the external API.
 */
app.get('/api/users', async (req, res) => {
    try {
        const { data } = await axios.get(`${EXTERNAL_API_BASE}/users`);
        res.json(data);
    } catch (err) {
        console.error('GET /api/users proxy error:', err.message);
        res.status(500).json({ message: 'Failed to fetch users from the external API.' });
    }
});

/**
 * @route   POST /api/users
 * @desc    Proxies creation of a new user to the external API.
 */
app.post('/api/users', async (req, res) => {
    try {
        const { data } = await axios.post(`${EXTERNAL_API_BASE}/users`, req.body);
        res.status(201).json(data);
    } catch (err) {
        console.error('POST /api/users proxy error:', err.message);
        const status = err.response?.status || 500;
        const message = err.response?.data?.message || 'Failed to create user via the external API.';
        res.status(status).json({ message });
    }
});

/**
 * @route   PUT /api/users/:id
 * @desc    Proxies updating an existing user to the external API.
 */
app.put('/api/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { data } = await axios.put(`${EXTERNAL_API_BASE}/users/${id}`, req.body);
        res.json(data);
    } catch (err) {
        console.error('PUT /api/users/:id proxy error:', err.message);
        const status = err.response?.status || 500;
        const message = err.response?.data?.message || 'Failed to update user via the external API.';
        res.status(status).json({ message });
    }
});

/**
 * @route   GET /api/departments
 * @desc    Proxies fetching departments to the external API.
 */
app.get('/api/departments', async (req, res) => {
    try {
        const { data } = await axios.get(`${EXTERNAL_API_BASE}/departments`);
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
    console.log(`✅ Front-end served at:`);
    console.log(`   • http://localhost:${PORT}`);
    console.log(`   • http://192.168.68.55:${PORT}`);
    console.log(`✅ API requests are being proxied to: ${EXTERNAL_API_BASE}`);
    console.log('--------------------------------------');
});

