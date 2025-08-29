// server.js

// --- 1. Import Dependencies ---
const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios'); // For making HTTP requests to the external API

// --- 2. Initialize the Express App ---
const app = express();
const PORT = 8080; // The port this server will run on.

// --- 3. Configuration ---
// The base URL of your actual, external API
const EXTERNAL_API_BASE = 'http://192.168.1.49:8080/api';

// --- 4. Middleware ---
app.use(cors()); // Enable Cross-Origin Resource Sharing
app.use(express.json()); // Enable the express app to parse JSON formatted request bodies
app.use(express.static(path.join(__dirname, ''))); // Serve static files (HTML, CSS, JS)

// --- 5. API Routes ---

/**
 * @route   POST /api/login
 * @desc    Handles user login by validating credentials against the external API.
 * This is a much more secure approach than fetching all users to the client.
 */
app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ message: 'Email and password are required.' });
        }

        // Fetch all users from the external API to validate credentials
        const { data: users } = await axios.get(`${EXTERNAL_API_BASE}/users`);

        const user = (Array.isArray(users) ? users : []).find(u => u.email === email);

        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // IMPORTANT: In a real-world scenario, password checking should be done
        // via a dedicated API endpoint, not by comparing plain text passwords.
        if (String(password) !== String(user.password)) {
            return res.status(401).json({ message: 'Invalid credentials.' });
        }

        // On successful login, send back a success message and user info
        return res.json({
            message: 'Login successful',
            userId: user.id, // Assuming the user object has an 'id'
            name: user.name || email,
        });

    } catch (err) {
        console.error('Login error:', err.message);
        return res.status(500).json({ message: 'Could not connect to the authentication service.' });
    }
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


// --- 6. Start the Server ---
app.listen(PORT, () => {
    console.log('--------------------------------------');
    console.log(`🚀 Advanced Server is running!`);
    console.log(`✅ Front-end served at http://localhost:${PORT}`);
    console.log(`✅ API requests are being proxied to: ${EXTERNAL_API_BASE}`);
    console.log('--------------------------------------');
});

