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


const crypto = require('crypto');
const privateKey = fs.readFileSync('private-key.pem', 'utf8');
const publicKey = fs.readFileSync('public-key.pem', 'utf8');

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

// Route to generate PDF and save to the database
app.post('/generate-pdf', async (req, res) => {
    try {
        const { name, amount, description, institute, signature } = req.body;

        // Format the amount as BRL currency (e.g., R$ 100,00)
        const formattedAmount = parseFloat(amount).toFixed(2).replace('.', ',');

        // Create a new PDF document
        const pdfDoc = await PDFDocument.create();

        // Load the representative's signature
        const repSignatureBytes = fs.readFileSync('glauboss.png'); // Update the path if necessary
        const repSignatureImage = await pdfDoc.embedPng(repSignatureBytes);

        // Add a page to the document
        const page = pdfDoc.addPage([595, 842]); // A4 size
        const { width, height } = page.getSize();

        // Set fonts
        const MYfont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const MYfontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // --- Title Section ---
        const titleY = height - 50; // Position for the title
        page.drawText('Glauco Foundation', {
            x: width / 2 - 80,
            y: titleY,
            size: 14,
            font: MYfontBold,
        });
        page.drawText('SOLICITAÇÃO DE DOAÇÃO', {
            x: width / 2 - 95,
            y: titleY - 20,
            size: 12,
            font: MYfontBold,
        });

        // Add extra space between the title and the description
        const infoYStart = titleY - 70;
        const lineSpacing = 20;

        // --- Description Section ---
        page.setFont(MYfontBold);
        page.drawText('Descrição:', { x: 50, y: infoYStart, size: 12 });
        page.setFont(MYfont);

        // Wrap long description text
        const maxLineWidth = width - 100;
        const wrappedDescription = wrapText(description, maxLineWidth, MYfont, 12, pdfDoc);
        wrappedDescription.forEach((line, index) => {
            page.drawText(line, { x: 150, y: infoYStart - index * lineSpacing, size: 12 });
        });

        // Draw institute and value below the description
        const instituteY = infoYStart - wrappedDescription.length * lineSpacing - lineSpacing;
        page.setFont(MYfontBold);
        page.drawText('Instituto:', { x: 50, y: instituteY, size: 12 });
        page.setFont(MYfont);
        page.drawText(institute, { x: 150, y: instituteY, size: 12 });

        const valueY = instituteY - lineSpacing;
        page.setFont(MYfontBold);
        page.drawText('Valor:', { x: 50, y: valueY, size: 12 });
        page.setFont(MYfont);
        page.drawText(`R$ ${formattedAmount}`, { x: 150, y: valueY, size: 12 });

        // --- Bottom Section: Signatures ---
        const boxWidth = 200;
        const boxHeight = 100;
        const boxY = 150;

        // Left (Applicant) Box
        const leftBoxX = width / 4 - boxWidth / 2;
        page.drawRectangle({
            x: leftBoxX,
            y: boxY,
            width: boxWidth,
            height: boxHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 1,
        });
        page.setFont(MYfontBold);
        page.drawText('Solicitante', { x: leftBoxX + boxWidth / 2 - 30, y: boxY + boxHeight - 15, size: 10 });

        // Applicant's name centered below the box
        page.setFont(MYfont);
        const nameWidth = MYfont.widthOfTextAtSize(name, 10);
        page.drawText(name, { x: leftBoxX + boxWidth / 2 - nameWidth / 2, y: boxY - 15, size: 10 });

        // Applicant's signature
        const solicSignatureImageBytes = signature.split(',')[1];
        const solicSignatureImage = await pdfDoc.embedPng(Buffer.from(solicSignatureImageBytes, 'base64'));

        const solicSignatureDims = solicSignatureImage.scale(0.35);
        page.drawImage(solicSignatureImage, {
            x: leftBoxX + boxWidth / 2 - solicSignatureDims.width / 2,
            y: boxY + 10,
            width: solicSignatureDims.width,
            height: solicSignatureDims.height,
        });

        // Right (Empty) Box
        const rightBoxX = (3 * width) / 4 - boxWidth / 2;
        page.drawRectangle({
            x: rightBoxX,
            y: boxY,
            width: boxWidth,
            height: boxHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 1,
        });
        page.setFont(MYfontBold);
        page.drawText('Representante', { x: rightBoxX + boxWidth / 2 - 50, y: boxY + boxHeight - 15, size: 10 });

        // Finalize the PDF document
        const pdfBytes = await pdfDoc.save();

        // Generate a random 7-digit ID for the PDF
        const randomId = Math.floor(1000000 + Math.random() * 9000000);

        // Define file path to save the PDF
        const filePath = path.join(__dirname, 'pedidos', `${randomId}.pdf`);

        // Save the PDF to the pedidos directory
        fs.writeFileSync(filePath, Buffer.from(pdfBytes));

        // Get the logged-in user's email from the session
        const userEmail = req.session.user.email;

        // Insert PDF details into the 'pedidos' table
        const query = `
            INSERT INTO pedidos (pdf_id, user_email)
            VALUES ($1, $2)
        `;
        await pool.query(query, [randomId, userEmail]);

        // Send the file path as the response
        res.status(200).json({ filePath: filePath, pdfId: randomId });
    } catch (error) {
        console.error('Erro ao gerar o PDF:', error);
        res.status(500).send('Erro ao gerar o PDF.');
    }
});



// Function to wrap text to fit within the maximum line width
function wrapText(text, maxLineWidth, font, fontSize, pdfDoc) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach((word) => {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        const testWidth = font.widthOfTextAtSize(testLine, fontSize);

        if (testWidth > maxLineWidth) {
            lines.push(currentLine);
            currentLine = word;
        } else {
            currentLine = testLine;
        }
    });

    if (currentLine) {
        lines.push(currentLine);
    }

    return lines;
}

// Serve static files from the 'pedidos' directory
app.use('/pedidos', express.static(path.join(__dirname, 'pedidos')));

// Route to get PDFs for the logged-in user
app.get('/get-user-pdfs', async (req, res) => {
    const { email } = req.query;

    if (!email) {
        return res.status(400).json({ error: "Email não fornecido." });
    }

    try {
        const result = await pool.query(
            'SELECT pdf_id FROM pedidos WHERE user_email = $1',
            [email]
        );
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('Erro ao buscar PDFs:', error);
        res.status(500).json({ error: "Erro ao buscar PDFs." });
    }
});

app.post('/sign-pdf', async (req, res) => {
    try {
        const { pdfId } = req.body;

        if (!pdfId) {
            return res.status(400).json({ error: "PDF ID não fornecido." });
        }

        // Load the existing PDF from the filesystem
        const filePath = path.join(__dirname, 'pedidos', `${pdfId}.pdf`);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "PDF não encontrado." });
        }
        const pdfBytes = fs.readFileSync(filePath);

        // Create a hash of the PDF content
        const pdfHash = crypto.createHash('sha256').update(pdfBytes).digest('hex');

        // Sign the hash with the private key
        const sign = crypto.createSign('SHA256');
        sign.update(pdfHash);
        const signature = sign.sign(privateKey, 'hex'); // Hexadecimal signature

        // Load the PDF and embed the signature
        const pdfDoc = await PDFDocument.load(pdfBytes);

        const signatureText = `Signature: ${signature}\nDate: ${new Date().toISOString()}`;
        const page = pdfDoc.getPage(0);

        page.drawText(signatureText, {
            x: 100,
            y: 100, // Position the signature at the bottom-left of the page
            size: 3,
            color: rgb(0, 0, 0),
        });

        // Save the signed PDF
        const signedPdfBytes = await pdfDoc.save();
        fs.writeFileSync(filePath, signedPdfBytes);

        // Update the database with the generated signature
        await pool.query(
            `UPDATE pedidos SET signature = $1 WHERE pdf_id = $2`,
            [signature, pdfId]
        );

        res.status(200).json({ message: 'PDF assinado com sucesso', pdfId, signature });
    } catch (error) {
        console.error('Erro ao assinar o PDF:', error);
        res.status(500).send('Erro ao assinar o PDF.');
    }
});


app.post('/verify-signature', async (req, res) => {
    try {
        const { pdfId } = req.body;

        if (!pdfId) {
            return res.status(400).json({ error: "PDF ID não fornecido." });
        }

        // Fetch the signature from the database (stored when signing the PDF)
        const pdfQuery = await pool.query('SELECT signature FROM pedidos WHERE pdf_id = $1', [pdfId]);
        if (pdfQuery.rows.length === 0) {
            return res.status(404).json({ error: "PDF não encontrado." });
        }

        const { signature } = pdfQuery.rows[0];

        // Load the existing PDF from the filesystem
        const filePath = path.join(__dirname, 'pedidos', `${pdfId}.pdf`);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ error: "PDF não encontrado." });
        }

        const pdfBytes = fs.readFileSync(filePath);

        // Recreate the hash
        const pdfHash = crypto.createHash('sha256').update(pdfBytes).digest('hex');

        // Verify the signature
        const verify = crypto.createVerify('SHA256');
        verify.update(pdfHash);
        const isValid = verify.verify(publicKey, signature, 'hex');

        if (isValid) {
            return res.status(200).json({ message: "Assinatura verificada com sucesso!" });
        } else {
            return res.status(400).json({ error: "Assinatura inválida." });
        }
    } catch (error) {
        console.error("Erro ao verificar a assinatura:", error);
        res.status(500).json({ error: "Erro ao verificar a assinatura." });
    }
});


  


// Start the server
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
