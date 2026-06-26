exports.handler = async (event, context) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body);
    const { type } = body;

    if (type === 'cj_auth') {
      const { email, password } = body;
      const response = await fetch('https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    if (type === 'cj_search') {
      const { accessToken, keyword, pageNum = 1, pageSize = 20 } = body;
      const params = new URLSearchParams({
        productNameEn: keyword,
        pageNum: String(pageNum),
        pageSize: String(pageSize)
      });
      const response = await fetch(`https://developers.cjdropshipping.com/api2.0/v1/product/list?${params}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'CJ-Access-Token': accessToken
        }
      });
      const data = await response.json();
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'API key not configured' }) };
    }

    const { messages, system } = body;
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: system || 'Eres el asistente IA de ORVEXIA, una tienda de dropshipping. Ayuda a los clientes con productos, pedidos y dudas.',
        messages
      })
    });

    const data = await response.json();
    return { statusCode: 200, headers, body: JSON.stringify(data) };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Proxy error', details: error.message })
    };
  }
};
