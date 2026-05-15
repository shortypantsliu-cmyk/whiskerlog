const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  // Auth check
  const token = event.headers['x-blob-token'];
  if (token !== process.env.BLOB_TOKEN) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON body' }) };
  }

  const { id, data } = body;
  const validIds = ['pip', 'parker', 'ollie', 'household'];
  if (!id || !validIds.includes(id)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid id. Must be pip, parker, ollie, or household.' }),
    };
  }
  if (!data || typeof data !== 'object') {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing or invalid data payload' }) };
  }

  try {
    const store = getStore({
      name: 'whiskerlog',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_TOKEN,
    });
    await store.setJSON(`cat_${id}`, data);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: true }),
    };
  } catch (err) {
    console.error('save-cat error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to save data' }) };
  }
};
