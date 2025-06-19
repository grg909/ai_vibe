// /api/translate.js

export default async function handler(request, response) {
  // CORS Headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }
  if (request.method !== 'POST') {
    return response.status(405).json({ error: { message: 'Only POST requests allowed' } });
  }

  // --- Securely get configuration from Vercel's environment variables ---
  const apiKey = process.env.GOOGLE_API_KEY;
  const translationModel = process.env.TRANSLATION_MODEL || 'gemini-1.5-flash';
  const ttsVoiceName = process.env.TTS_VOICE_NAME;

  if (!apiKey) {
    return response.status(500).json({ error: { message: 'API Key is not configured on the server.' } });
  }

  const { task, requestBody } = request.body;
  if (!task || !requestBody) {
    return response.status(400).json({ error: { message: 'Missing task or requestBody.' } });
  }

  let googleApiUrl;
  let finalRequestBody;

  switch (task) {
    case 'TRANSLATION':
      // Use the model name from environment variables
      googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${translationModel}:generateContent?key=${apiKey}`;

      // NEW: Build the request body for Gemini, checking if an image is present
      const parts = [{ text: requestBody.prompt }];
      if (requestBody.image) {
        parts.push({
          inline_data: {
            mime_type: requestBody.image.mimeType,
            data: requestBody.image.data
          }
        });
      }

      finalRequestBody = {
        contents: [{ parts }],
        generationConfig: requestBody.generationConfig || {}
      };
      break;

    case 'TTS':
      googleApiUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
      const voiceConfig = { languageCode: requestBody.languageCode, ssmlGender: 'NEUTRAL' };
      if (ttsVoiceName) {
        voiceConfig.name = ttsVoiceName;
      }
      finalRequestBody = {
        input: { text: requestBody.text },
        voice: voiceConfig,
        audioConfig: { audioEncoding: 'MP3' }
      };
      break;

    default:
      return response.status(400).json({ error: { message: `Unknown task: ${task}` } });
  }

  try {
    const googleResponse = await fetch(googleApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(finalRequestBody),
    });

    const data = await googleResponse.json();
    if (!googleResponse.ok) {
        throw new Error(data.error?.message || 'Google API Error');
    }
    return response.status(200).json(data);

  } catch (error) {
    console.error('Proxy Internal Error:', error);
    return response.status(500).json({ error: { message: 'An internal server error occurred.' }});
  }
}
