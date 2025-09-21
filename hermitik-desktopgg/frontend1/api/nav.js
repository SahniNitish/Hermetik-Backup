export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { method, headers, body, query } = req;
    
    // Remove host header to avoid conflicts
    const { host, ...cleanHeaders } = headers;
    
    // Add query parameters if they exist
    const queryString = new URLSearchParams(query).toString();
    const backendUrl = `http://23.20.137.235:3001/api/nav${queryString ? `?${queryString}` : ''}`;
    
    console.log(`🔄 Proxying ${method} request to: ${backendUrl}`);
    
    // Make request to backend
    const response = await fetch(backendUrl, {
      method,
      headers: {
        ...cleanHeaders,
        'Content-Type': 'application/json',
      },
      body: method !== 'GET' && method !== 'HEAD' ? JSON.stringify(body) : undefined,
    });
    
    // Get response data
    const data = await response.text();
    
    // Set response headers
    res.status(response.status);
    
    // Try to parse as JSON, fallback to text
    try {
      const jsonData = JSON.parse(data);
      res.json(jsonData);
    } catch {
      res.send(data);
    }
    
  } catch (error) {
    console.error('❌ Proxy error:', error);
    res.status(500).json({ 
      error: 'Proxy request failed', 
      message: error.message 
    });
  }
}
