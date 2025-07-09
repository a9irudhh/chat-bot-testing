require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(bodyParser.json());

const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const credentials = JSON.parse(fs.readFileSync(path.resolve(CREDENTIALS_PATH), 'utf-8'));

const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET_NAME = process.env.SHEET_NAME;

function parseChatMessage(text) {
  const lines = text.trim().split('\n');
  const data = {};

  for (let i = 0; i < lines.length; i += 2) {
    const key = lines[i]?.trim();
    const value = lines[i + 1]?.trim() || '';
    data[key] = value;
  }

  return [
    data["Key"],
    data["Agent Name"],
    data["Reason for retraining"]
  ];
}

app.post('/chat-listener', async (req, res) => {
  try {
    const message = req.body.message?.text || '';
    const row = parseChatMessage(message);

    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:C1`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [row],
      },
    });

    res.send({ text: 'Row added to sheet!' });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: 'Something went wrong' });
  }
});

app.listen(3000, () => {
  console.log('✅ Server running on http://localhost:3000');
});
