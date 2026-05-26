// netlify/functions/send-sms.js
// Sends an SMS via the Twilio REST API using native fetch (no npm packages).
// Credentials are read from Netlify environment variables — never hardcoded.

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  // ── CORS preflight ──────────────────────────────────────────────
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  // ── Method guard ────────────────────────────────────────────────
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  // ── Parse body ──────────────────────────────────────────────────
  let message;
  try {
    ({ message } = JSON.parse(event.body || '{}'));
  } catch (_) {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Invalid JSON body' }),
    };
  }

  if (!message) {
    return {
      statusCode: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing required field: message' }),
    };
  }

  // ── Read credentials from environment ───────────────────────────
  const accountSid  = process.env.TWILIO_ACCOUNT_SID;
  const authToken   = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber  = process.env.TWILIO_PHONE_NUMBER;
  const toNumber    = process.env.OWNER_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber || !toNumber) {
    console.error('send-sms: one or more Twilio env vars are missing');
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  // ── Call Twilio REST API ─────────────────────────────────────────
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  const body = new URLSearchParams({ To: toNumber, From: fromNumber, Body: message });

  try {
    const response = await fetch(twilioUrl, {
      method:  'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const json = await response.json();

    if (!response.ok) {
      console.error('Twilio error:', json);
      return {
        statusCode: 500,
        headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to send SMS', detail: json }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, sid: json.sid }),
    };

  } catch (err) {
    console.error('send-sms fetch error:', err);
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Network error contacting Twilio' }),
    };
  }
};
