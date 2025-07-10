require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const app = express();
app.use(bodyParser.json());

const creds = JSON.parse(fs.readFileSync(path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS), 'utf-8'));
const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEET = process.env.SHEET_NAME;

function parseChatMessage(text) {
  const lines = text.trim().split('\n');
  const data = {};
  for (let i = 0; i < lines.length; i += 2) {
    data[lines[i]] = lines[i + 1] || '';
  }
  return [
    data["Key"],
    data["Agent Name"],
    data["Reason for retraining"]
  ];
}

const router = express.Router();

router.post('/added-to-space', (req, res) => {
  const event = req.body;
  return res.json({
    text: `Hi! Thanks for adding me to ${event.space.displayName || 'this space'}.`
  });
});

router.post('/removed-from-space', (req, res) => {
  console.log(`Removed from space: ${req.body.space.name}`);
  return res.status(200).end();
});

router.post('/message', async (req, res) => {
  res.status(200).end();
  try {
    const row = parseChatMessage(req.body.message.text);
    const sheetsClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: sheetsClient });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET}!A1:C1`,
      valueInputOption: 'RAW',
      requestBody: { values: [row] },
    });
    console.log('Appended row:', row);
  } catch (err) {
    console.error('Error appending row:', err);
  }
});

router.post('/command', (req, res) => {
  const cmd = req.body.appCommand?.commandId || '';
  const reply = cmd === 'about'
    ? 'I can log retraining requests into Sheets automatically!'
    : "Sorry, I didn't recognize that command.";
  return res.json({ text: reply });
});

app.use('/chat-listener', router);

app.post('/chat-listener/*', (req, res) => res.status(404).end());

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
