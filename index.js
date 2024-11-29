require('dotenv').config();

const fs = require('fs'); // Make sure to require the fs module at the top

const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const session = require('express-session'); // Session middleware
const bodyParser = require('body-parser'); // Added from your friend's code
const cors = require('cors'); // Added from your friend's code
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib'); // Added from your friend's code

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
app.use(cors()); // Added from your friend's code
app.use(bodyParser.json({ limit: '10mb' })); // Added from your friend's code

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

    // Read the dashboard.html file
    fs.readFile(path.join(__dirname, 'pages', 'dashboard.html'), 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading dashboard.html:', err);
            return res.status(500).send('Erro interno do servidor.');
        }

        // Replace the placeholder with the actual username
        const updatedHtml = data.replace('{{userName}}', userName);

        // Send the updated HTML file as the response
        res.send(updatedHtml);
    });
});

// Route to generate PDF (from your friend's code)
app.post('/generate-pdf', async (req, res) => {
    try {
        const { name, amount, description, institute, signature } = req.body;

        // Create a new PDF document
        const pdfDoc = await PDFDocument.create();

        // Load the representative's signature (fixed)
        const repSignatureBytes = fs.readFileSync('glauboss.png'); // Update the path if necessary
        const repSignatureImage = await pdfDoc.embedPng(repSignatureBytes);

        // Add a page to the document
        const page = pdfDoc.addPage([595, 842]); // A4 size
        const { width, height } = page.getSize();

        // Set a default font
        const MYfont = await pdfDoc.embedFont(StandardFonts.Helvetica);

        // --- Top section: Description, Institute, and Value ---
        const infoYStart = height - 50; // Start position near the top
        const lineSpacing = 20;
        page.setFont(MYfont);
        page.drawText('Descrição: ' + description, { x: 50, y: infoYStart, size: 12, font: MYfont });
        page.drawText('Instituto: ' + institute, { x: 50, y: infoYStart - lineSpacing, size: 12, font: MYfont });
        page.drawText('Valor: R$ ' + amount, { x: 50, y: infoYStart - lineSpacing * 2, size: 12, font: MYfont });

        // --- Bottom section: Signatures and names ---
        const boxWidth = 200; // Width of the signature boxes
        const boxHeight = 100; // Height of the signature boxes
        const boxY = 150; // Fixed vertical position for the boxes

        // Applicant
        const solicX = 50; // Horizontal position for the applicant
        page.drawRectangle({
            x: solicX,
            y: boxY,
            width: boxWidth,
            height: boxHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 1,
        });
        page.drawText('Solicitante', { x: solicX + 10, y: boxY + boxHeight - 15, size: 10, font: MYfont });
        page.drawText(name, { x: solicX + 10, y: boxY - 15, size: 10, font: MYfont });

        // Applicant's signature
        const solicSignatureImageBytes = signature.split(',')[1]; // Remove the "data:image/png;base64," prefix
        const solicSignatureImage = await pdfDoc.embedPng(Buffer.from(solicSignatureImageBytes, 'base64'));

        // Scale the applicant's signature to 35% of its original size
        const solicSignatureDims = solicSignatureImage.scale(0.35);

        page.drawImage(solicSignatureImage, {
            x: solicX + 10,
            y: boxY + 10,
            width: solicSignatureDims.width,
            height: solicSignatureDims.height,
        });

        // Representative
        const repX = solicX + boxWidth + 50; // Horizontal position for the representative
        page.drawRectangle({
            x: repX,
            y: boxY,
            width: boxWidth,
            height: boxHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 1,
        });
        page.drawText('Representante', { x: repX + 10, y: boxY + boxHeight - 15, size: 10, font: MYfont });
        page.drawText('João', { x: repX + 10, y: boxY - 15, size: 10, font: MYfont });

        // Representative's signature
        const repSignatureDims = repSignatureImage.scale(0.35); // Scale the representative's signature to 35%
        page.drawImage(repSignatureImage, {
            x: repX + 10,
            y: boxY + 10,
            width: repSignatureDims.width,
            height: repSignatureDims.height,
        });

        // Finalize and send the PDF
        const pdfBytes = await pdfDoc.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.send(Buffer.from(pdfBytes)); // Send the PDF as a response
    } catch (error) {
        console.error('Erro ao gerar o PDF:', error.message);
        res.status(500).send('Erro ao gerar o PDF.');
    }
});

// Error handling for missing .env configuration
if (!process.env.PORT) {
    console.warn('Warning: PORT is not defined in .env. Using default port 4200.');
}

app.listen(PORT, () => {
    console.log(`Listening to http://localhost:${PORT}`);
});
