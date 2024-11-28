// const canvas = document.getElementById('signature-pad');
//     const ctx = canvas.getContext('2d');
//     let drawing = false;
    
//     // Funções de desenho na assinatura
//     canvas.addEventListener('mousedown', (e) => {
//         drawing = true;
//         ctx.beginPath();
//         ctx.moveTo(e.offsetX, e.offsetY);
//     });
    
//     canvas.addEventListener('mousemove', (e) => {
//         if (!drawing) return;
//         ctx.lineTo(e.offsetX, e.offsetY);
//         ctx.strokeStyle = 'black';
//         ctx.lineWidth = 2;
//         ctx.stroke();
//     });
    
//     canvas.addEventListener('mouseup', () => {
//         drawing = false;
//         ctx.closePath();
//     });
    
//     document.getElementById('clear-signature').addEventListener('click', () => {
//         ctx.clearRect(0, 0, canvas.width, canvas.height);
//     });
    
//     // Submissão do formulário
//     document.getElementById('donation-form').addEventListener('submit', async (e) => {
//         e.preventDefault();
    
//         const formData = new FormData(e.target);
//         const signature = canvas.toDataURL(); // Captura a assinatura como base64
    
//         const data = {
//             name: formData.get('name'),
//             amount: formData.get('amount'),
//             description: formData.get('description'),
//             institute: formData.get('institute'),
//             signature,
//         };
    
//         // Envia para o servidor
//         const response = await fetch('/generate-pdf', {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify(data),
//         });
    
//         const blob = await response.blob();
//         const url = window.URL.createObjectURL(blob);
    
//         // Baixa o arquivo PDF gerado
//         const a = document.createElement('a');
//         a.href = url;
//         a.download = 'donation_receipt.pdf';
//         document.body.appendChild(a);
//         a.click();
//         document.body.removeChild(a);
//     });