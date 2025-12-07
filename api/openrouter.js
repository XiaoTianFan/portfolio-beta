// Helper function to get allowed origin based on environment
function getAllowedOrigin(req) {
  const origin = req.headers.origin || req.headers.referer;
  const isProduction = process.env.VERCEL_ENV === 'production';
  
  // In production, only allow beta.xiaotianfanx.com
  if (isProduction) {
    if (origin && origin.includes('beta.xiaotianfanx.com')) {
      return origin;
    }
    return null; // Reject other origins in production
  }
  
  // In development, allow localhost and local dev server
  if (origin) {
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
      return origin;
    }
  }
  
  // Fallback: allow all in development (for local Vercel dev server)
  return '*';
}

export default async function handler(req, res) {
  const allowedOrigin = getAllowedOrigin(req);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    if (allowedOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    return res.status(200).end();
  }

  // Set CORS headers for all responses
  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (process.env.VERCEL_ENV === 'production') {
    // Reject unauthorized origins in production
    return res.status(403).json({ error: 'Forbidden: Origin not allowed' });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    return res.status(500).json({ error: 'OpenRouter API key not configured' });
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': req.headers.referer || req.headers.origin || '',
        'X-Title': 'Portfolio Assistant'
      },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      const errorData = await response.text();
      return res.status(response.status).json({ 
        error: `OpenRouter API error: ${response.status}`,
        details: errorData
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('OpenRouter proxy error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message 
    });
  }
}

