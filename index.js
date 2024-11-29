const express = require('express');
const bodyParser = require('body-parser');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const cors = require('cors');

const repSignatureBytes = fs.readFileSync('glauboss.png');


const app = express();
const PORT = 3000;
app.use(cors());


// Configurações para o Express
app.use(bodyParser.json({ limit: '10mb' })); // Aceita JSON grande (para a assinatura)

// Rota para gerar o PDF
app.post('/generate-pdf', async (req, res) => {
    try {
        const { name, amount, description, institute, signature } = req.body;

        // Crie um novo documento PDF
        const pdfDoc = await PDFDocument.create();

        // Carregue a assinatura do representante (fixa)
        const repSignatureBytes = fs.readFileSync('glauboss.png'); // Substitua pelo caminho correto da assinatura do representante
        const repSignatureImage = await pdfDoc.embedPng(repSignatureBytes);

        // Adicione uma página ao documento
        const page = pdfDoc.addPage([595, 842]); // Tamanho A4 (595 x 842 pontos)
        const { width, height } = page.getSize();

        // Defina uma fonte padrão (corrigido)
        const MYfont = await pdfDoc.embedFont(StandardFonts.Helvetica);
         // Corrigido para embedStandardFont

        // --- Parte superior: Descrição, Instituto e Valor ---
        const infoYStart = height - 50; // Posição inicial no topo
        const lineSpacing = 20;
        page.setFont(MYfont)
        page.drawText('Descrição: ' + description, { x: 50, y: infoYStart, size: 12, MYfont });
        page.drawText('Instituto: ' + institute, { x: 50, y: infoYStart - lineSpacing, size: 12, MYfont });
        page.drawText('Valor: R$ ' + amount, { x: 50, y: infoYStart - lineSpacing * 2, size: 12, MYfont });

        // --- Parte inferior: Assinaturas e nomes ---
        const boxWidth = 200; // Largura dos quadros de assinaturas
        const boxHeight = 100; // Altura dos quadros de assinaturas
        const boxY = 150; // Posição vertical fixa para os quadros

        // Solicitante
        const solicX = 50; // Posição horizontal do solicitante
        page.drawRectangle({
            x: solicX,
            y: boxY,
            width: boxWidth,
            height: boxHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 1,
        });
        page.drawText('Solicitante', { x: solicX + 10, y: boxY + boxHeight - 15, size: 10, MYfont });
        page.drawText(name, { x: solicX + 10, y: boxY - 15, size: 10, MYfont });

        // Assinatura do solicitante
        const solicSignatureImageBytes = signature.split(',')[1]; // Retira o prefixo "data:image/png;base64,"
        const solicSignatureImage = await pdfDoc.embedPng(Buffer.from(solicSignatureImageBytes, 'base64'));
        const solicSignatureDims = solicSignatureImage.scale(0.5);

        page.drawImage(solicSignatureImage, {
            x: solicX + 10,
            y: boxY + 10,
            width: solicSignatureDims.width,
            height: solicSignatureDims.height,
        });

        // Representante
        const repX = solicX + boxWidth + 50; // Posição horizontal do representante
        page.drawRectangle({
            x: repX,
            y: boxY,
            width: boxWidth,
            height: boxHeight,
            borderColor: rgb(0, 0, 0),
            borderWidth: 1,
        });
        page.drawText('Representante', { x: repX + 10, y: boxY + boxHeight - 15, size: 10, MYfont });
        page.drawText('João', { x: repX + 10, y: boxY - 15, size: 10, MYfont });

        // Assinatura do representante
        const repSignatureDims = repSignatureImage.scale(0.5);
        page.drawImage(repSignatureImage, {
            x: repX + 10,
            y: boxY + 10,
            width: repSignatureDims.width,
            height: repSignatureDims.height,
        });

        // Finalize e envie o PDF
        const pdfBytes = await pdfDoc.save();
        res.setHeader('Content-Type', 'application/pdf');
        res.send(Buffer.from(pdfBytes)); // Envia o PDF como resposta
    } catch (error) {
        console.error('Erro ao gerar o PDF:', error.message);
        res.status(500).send('Erro ao gerar o PDF.');
    }
});

// Inicie o servidor
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta http://localhost:${PORT}`);
});