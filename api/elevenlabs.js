export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'ElevenLabs API key not configured' });
  }

  try {
    const { voiceId, text, modelId, outputFormat } = req.body;

    if (!voiceId || !text) {
      return res.status(400).json({ error: 'Missing required parameters: voiceId and text' });
    }

    // Construct the ElevenLabs API URL
    const apiUrl = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
    
    // Prepare query parameters
    const params = new URLSearchParams();
    if (modelId) params.append('model_id', modelId);
    if (outputFormat) params.append('output_format', outputFormat);
    
    const urlWithParams = params.toString() 
      ? `${apiUrl}?${params.toString()}` 
      : apiUrl;

    const response = await fetch(urlWithParams, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({ text })
    });

    if (!response.ok) {
      const errorData = await response.text();
      return res.status(response.status).json({ 
        error: `ElevenLabs API error: ${response.status}`,
        details: errorData
      });
    }

    // Get the audio data as ArrayBuffer
    const audioBuffer = await response.arrayBuffer();
    
    // Convert to base64 for JSON response, or send as binary
    // We'll send as base64 so the frontend can decode it
    const base64Audio = Buffer.from(audioBuffer).toString('base64');
    
    return res.status(200).json({
      audio: base64Audio,
      format: outputFormat || 'mp3_44100_128'
    });
  } catch (error) {
    console.error('ElevenLabs proxy error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

