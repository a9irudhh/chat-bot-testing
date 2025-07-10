require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const app = express();
app.use(bodyParser.json());


const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});


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
  return [data['Key'], data['Agent Name'], data['Reason for retraining']];
}

app.post('/added-to-space', (req, res) => {
  const event = req.body;
  return res.json({
    text: `Hi! Thanks for adding me to ${event.space.displayName || 'this space'}.`
  });
});

app.post('/removed-from-space', (req, res) => {
  console.log(`Removed from space: ${req.body.space.name}`);
  return res.status(200).end();
});

app.post('/message', async (req, res) => {
  const event = req.body;
  res.status(200).end();
  try {
    const row = parseChatMessage(event.message.text);
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });
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

app.post('/command', (req, res) => {
  const event = req.body;
  const cmd = event.appCommand?.commandId;
  let reply = 'Hmm, not sure what that means!';
  if (cmd === 'about' || cmd === '/about') {
    reply = 'I help log retraining requests automatically into Sheets!';
  }
  return res.json({ text: reply });
});

app.post('/chat-listener', (req, res) => {
  const evt = req.body.type;
  if (evt === 'ADDED_TO_SPACE') return app.handle(req, res, '/added-to-space');
  if (evt === 'REMOVED_FROM_SPACE') return app.handle(req, res, '/removed-from-space');
  if (evt === 'MESSAGE') return app.handle(req, res, '/message');
  if (evt === 'APP_COMMAND') return app.handle(req, res, '/command');
  return res.status(200).end(); 
}
);


