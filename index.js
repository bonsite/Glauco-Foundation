require('dotenv').config();

const express = require('express');
const { neon } = require('@neondatabase/serverless');

const app = express();
const PORT = process.env.PORT || 4200;

app.get('/', async (_, res) => {
  const sql = neon(`${process.env.DATABASE_URL}`);
  const response = await sql`SELECT version()`;
  const { version } = response[0];
  res.json({ version });
});

app.listen(PORT, () => {
  console.log(`Listening to http://localhost:${PORT}`);
});