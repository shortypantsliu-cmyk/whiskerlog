const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  // Auth check
  const token = event.headers['x-blob-token'];
  if (token !== process.env.BLOB_TOKEN) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const id = event.queryStringParameters?.id;
  const validIds = ['pip', 'parker', 'ollie', 'household'];
  if (!id || !validIds.includes(id)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid id. Must be pip, parker, ollie, or household.' }),
    };
  }

  try {
    const store = getStore({
      name: 'whiskerlog',
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_TOKEN,
    });
    const data = await store.get(`cat_${id}`, { type: 'json' });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data ?? null),
    };
  } catch (err) {
    console.error('get-cat error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to load data' }) };
  }
};
