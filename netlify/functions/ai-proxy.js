// =====================================================
// ORVEXIA — Netlify Function: ai-proxy.js
// Ubicación: netlify/functions/ai-proxy.js
// Maneja: cj_auth, cj_search, cj_product_detail
// =====================================================

const CJ_BASE = 'https://developers.cjdropshipping.com/api2.0/v1';

exports.handler = async function (event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ result: false, message: 'Method not allowed' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ result: false, message: 'Invalid JSON body' }) };
  }

  try {
    switch (body.type) {
      case 'cj_auth':   return await handleCJAuth(body, headers);
      case 'cj_search': return await handleCJSearch(body, headers);
      case 'cj_product_detail': return await handleCJProductDetail(body, headers);
      default:
        return { statusCode: 400, headers, body: JSON.stringify({ result: false, message: `Tipo desconocido: ${body.type}` }) };
    }
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ result: false, message: err.message }) };
  }
};

async function handleCJAuth(body, headers) {
  const { email, password } = body;
  if (!email || !password)
    return { statusCode: 400, headers, body: JSON.stringify({ result: false, message: 'Email y contraseña requeridos' }) };

  const resp = await fetch(`${CJ_BASE}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await resp.json();

  if (!data.result || !data.data?.accessToken)
    return { statusCode: 401, headers, body: JSON.stringify({ result: false, message: data.message || 'Credenciales inválidas en CJ' }) };

  return { statusCode: 200, headers, body: JSON.stringify({ result: true, data: { accessToken: data.data.accessToken, refreshToken: data.data.refreshToken || '', email } }) };
}

async function handleCJSearch(body, headers) {
  const { token, keyword, pageNum = 1, pageSize = 20, categoryId = '' } = body;

  if (!token)
    return { statusCode: 401, headers, body: JSON.stringify({ result: false, message: 'Token CJ requerido. Reconecta tu cuenta.' }) };
  if (!keyword?.trim())
    return { statusCode: 400, headers, body: JSON.stringify({ result: false, message: 'Keyword requerida' }) };

  const params = new URLSearchParams({ productNameEn: keyword.trim(), pageNum: String(pageNum), pageSize: String(pageSize) });
  if (categoryId) params.append('categoryId', categoryId);

  const resp = await fetch(`${CJ_BASE}/product/list?${params}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'CJ-Access-Token': token },
  });
  const data = await resp.json();

  if (!data.result && (resp.status === 401 || data.message?.toLowerCase().includes('token')))
    return { statusCode: 401, headers, body: JSON.stringify({ result: false, message: 'Token CJ expirado. Reconecta tu cuenta CJ.' }) };

  if (!data.result)
    return { statusCode: 200, headers, body: JSON.stringify({ result: false, message: data.message || 'Error buscando en CJ', data: { list: [], total: 0 } }) };

  const rawList = data.data?.list || data.data?.result || [];
  const list = rawList.map(p => ({
    pid: p.pid || p.productId || '',
    productName: p.productNameEn || p.productName || 'Producto sin nombre',
    productNameEn: p.productNameEn || p.productName || '',
    productImage: p.productImage || p.productImageSet || '',
    sellPrice: parseFloat(p.sellPrice || p.productPrice || 0),
    categoryName: p.categoryName || p.category || 'General',
    categoryId: p.categoryId || '',
    variants: p.variants || [],
  }));

  return { statusCode: 200, headers, body: JSON.stringify({ result: true, data: { list, total: data.data?.total || list.length, pageNum, pageSize } }) };
}

async function handleCJProductDetail(body, headers) {
  const { token, pid } = body;
  if (!token) return { statusCode: 401, headers, body: JSON.stringify({ result: false, message: 'Token CJ requerido' }) };
  if (!pid)   return { statusCode: 400, headers, body: JSON.stringify({ result: false, message: 'pid requerido' }) };

  const resp = await fetch(`${CJ_BASE}/product/query?pid=${encodeURIComponent(pid)}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'CJ-Access-Token': token },
  });
  const data = await resp.json();

  if (!data.result)
    return { statusCode: 200, headers, body: JSON.stringify({ result: false, message: data.message || 'Producto no encontrado' }) };

  return { statusCode: 200, headers, body: JSON.stringify({ result: true, data: data.data }) };
}
