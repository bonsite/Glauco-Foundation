require('dotenv').config();

const express = require('express');
const path = require('path'); // Import the path module
const { neon } = require('@neondatabase/serverless'); // Assuming you will use this in the future

const app = express();
const PORT = process.env.PORT || 4200;

// Serve static files from the "pages" directory
app.use(express.static(path.join(__dirname, 'pages')));

app.get('/', (request, response) => {
	// Render login template
	response.sendFile(path.join(__dirname, 'pages', 'login.html'));
});

// Error handling for missing .env configuration
if (!process.env.PORT) {
  console.warn('Warning: PORT is not defined in .env. Using default port 4200.');
}

app.listen(PORT, () => {
  console.log(`Listening to http://localhost:${PORT}`);
});
