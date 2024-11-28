require('dotenv').config();

const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt'); // For password hashing
const { Pool } = require('pg'); // PostgreSQL client

const app = express();
const PORT = process.env.PORT || 4200;

// PostgreSQL setup
const pool = new Pool({
    connectionString: process.env.DATABASE_URL, // Ensure this is set in your .env file
    ssl: {
        rejectUnauthorized: false
    }
});

// Middleware to parse form data
app.use(express.urlencoded({ extended: true }));

// Serve static files from the "pages" directory
app.use(express.static(path.join(__dirname, 'pages')));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'pages', 'register.html'));
});

app.post('/register', async (req, res) => {
    // Access the correct keys from req.body
    const { name, email, password, 'confirm-password': confirmPassword } = req.body;

    // Validation: Check if all fields are provided
    if (!name || !email || !password || !confirmPassword) {
        return res.status(400).send('Todos os campos são obrigatórios.');
    }

    // Validation: Check if passwords match
    if (password !== confirmPassword) {
        return res.status(400).send('As senhas não coincidem.');
    }

    // Check if password meets certain criteria (e.g., length, complexity)
    if (password.length < 8) {
        return res.status(400).send('A senha precisa ter pelo menos 8 caracteres.');
    }

    try {
        // Check if email already exists
        const userCheck = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
        if (userCheck.rows.length > 0) {
            return res.status(400).send('E-mail já cadastrado.');
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user into the database
        await pool.query(
            'INSERT INTO users (name, email, password) VALUES ($1, $2, $3)',
            [name, email, hashedPassword]
        );

        res.status(201).send('Conta criada com sucesso!');
    } catch (error) {
        console.error('Erro ao criar conta:', error);
        // Send more detailed error message
        if (error.code === '23505') { // Unique constraint violation (duplicate email)
            res.status(400).send('E-mail já está em uso.');
        } else {
            res.status(500).send('Erro interno do servidor.');
        }
    }
});


// Error handling for missing .env configuration
if (!process.env.PORT) {
    console.warn('Warning: PORT is not defined in .env. Using default port 4200.');
}

app.listen(PORT, () => {
    console.log(`Listening to http://localhost:${PORT}`);
});
