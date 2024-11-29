require('dotenv').config();

const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const session = require('express-session'); // Session middleware

const app = express();
const PORT = process.env.PORT || 4200;

// PostgreSQL setup
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'pages')));

// Session setup
app.use(session({
    secret: 'your-secret-key', // Change this to a more secure key
    resave: false,
    saveUninitialized: true
}));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'register.html'));
});

// Login route
app.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).send('E-mail e senha são obrigatórios.');
    }

    try {
        const userCheck = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length === 0) {
            return res.status(400).send('E-mail ou senha incorretos.');
        }

        const user = userCheck.rows[0];
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(400).send('E-mail ou senha incorretos.');
        }

        // Store the user information in the session
        req.session.user = {
            id: user.id,
            name: user.name,
            email: user.email
        };

        res.status(200).redirect('/dashboard');
    } catch (error) {
        console.error('Erro ao fazer login:', error);
        res.status(500).send('Erro interno do servidor.');
    }
});

// Dashboard route - Display user options
app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/');
    }

    const userName = req.session.user.name;

    // Save the user's name to localStorage to be accessed in the client-side script
    res.sendFile(path.join(__dirname, 'pages', 'dashboard.html'), () => {
        res.write(`
            <script>
                localStorage.setItem("userName", "${userName}");
            </script>
        `);
        res.end();
    });
});


// Error handling for missing .env configuration
if (!process.env.PORT) {
    console.warn('Warning: PORT is not defined in .env. Using default port 4200.');
}

app.listen(PORT, () => {
    console.log(`Listening to http://localhost:${PORT}`);
});
