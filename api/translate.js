// /api/translate.js

// This function handles requests to the Google AI APIs securely.
export default async function handler(request, response) {
  // Allow requests from any origin during development, but you might want to restrict this in production.
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests for CORS
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  if (request.method !== 'POST') {
    return response.status(405).json({ error: { message: 'Only POST requests allowed' } });
  }

  // --- Securely get configuration from Vercel's environment variables ---
  const apiKey = process.env.GOOGLE_API_KEY;
  const translationModel = process.env.TRANSLATION_MODEL || 'gemini-1.5-flash';
  // Get the TTS voice name from env, this is optional.
  const ttsVoiceName = process.env.TTS_VOICE_NAME;

  if (!apiKey) {
    return response.status(500).json({ error: { message: 'API Key is not configured on the server.' } });
  }

  // Extract the task type and the actual request body from the frontend's request
  const { task, requestBody } = request.body;

  if (!task || !requestBody) {
    return response.status(400).json({ error: { message: 'Missing task or requestBody in the request.' } });
  }

  let googleApiUrl;
  let finalRequestBody;

  // Determine the correct Google API endpoint and build the request body based on the task
  switch (task) {
    case 'TRANSLATION':
      googleApiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${translationModel}:generateContent?key=${apiKey}`;
      finalRequestBody = requestBody; // The body from frontend is already correct for this task
      break;

    case 'TTS':
      googleApiUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

      // Construct the full request body for the TTS API on the backend
      const voiceConfig = {
        languageCode: requestBody.languageCode,
        ssmlGender: 'NEUTRAL'
      };

      // If a specific voice name is set in env vars, add it to the config
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
    // Forward the request to the corresponding Google API
    const googleResponse = await fetch(googleApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(finalRequestBody),
    });

    // Proxy the response from Google back to the client
    const data = await googleResponse.json();

    if (!googleResponse.ok) {
        // If Google returns an error, forward it
        console.error('Google API Error:', data);
        return response.status(googleResponse.status).json(data);
    }

    return response.status(200).json(data);

  } catch (error) {
    console.error('Proxy Internal Error:', error);
    return response.status(500).json({ error: { message: 'An internal server error occurred in the proxy.' }});
  }
}
