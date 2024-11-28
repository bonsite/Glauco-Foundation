const express = require('express');
const bodyParser = require('body-parser');
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const cors = require('cors');



const app = express();
const PORT = 3000;
app.use(cors());


// Configurações para o Express
app.use(bodyParser.json({ limit: '10mb' })); // Aceita JSON grande (para a assinatura)

// Rota para gerar o PDF
app.post('/generate-pdf', async (req, res) => {
    const { name, amount, description, institute, signature } = req.body;

    try {
        // Cria um novo documento PDF
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([600, 400]);

        // Adiciona texto ao PDF
        page.drawText(`Recibo de Doação`, { x: 50, y: 350, size: 18, color: rgb(0, 0, 0) });
        page.drawText(`Nome: ${name}`, { x: 50, y: 320, size: 12 });
        page.drawText(`Valor da Doação: R$ ${amount}`, { x: 50, y: 300, size: 12 });
        page.drawText(`Descrição: ${description}`, { x: 50, y: 280, size: 12 });
        page.drawText(`Instituto: ${institute}`, { x: 50, y: 260, size: 12 });

        // Adiciona a assinatura ao PDF
        if (signature) {
            const signatureImage = signature.split(',')[1]; // Remove o prefixo 'data:image/png;base64,'
            const signatureBytes = Buffer.from(signatureImage, 'base64');
            const embeddedSignature = await pdfDoc.embedPng(signatureBytes);

            page.drawImage(embeddedSignature, {
                x: 50,
                y: 100,
                width: 200,
                height: 80,
            });
        }

        // Salva o PDF em bytes
        const pdfBytes = await pdfDoc.save();

        // Envia o PDF como resposta
        res.setHeader('Content-Type', 'application/pdf');
        res.send(Buffer.from(pdfBytes));
    } catch (error) {
        console.error('Erro ao gerar o PDF:', error);
        res.status(500).send('Erro ao gerar o PDF.');
    }
});

// Inicia o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
