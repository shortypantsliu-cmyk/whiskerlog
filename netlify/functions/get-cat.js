const { getStore } = require('@netlify/blobs');

exports.handler = async (event) => {
  // Auth check
  const token = event.headers['x-blob-token'];
  if (token !== process.env.BLOB_TOKEN) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const id = event.queryStringParameters?.id;
  const validIds = ['pip', 'parker', 'ollie'];
  if (!id || !validIds.includes(id)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Invalid cat id. Must be pip, parker, or ollie.' }),
    };
  }

  try {
    const store = getStore('whiskerlog');
    const data = await store.get(`cat_${id}`, { type: 'json' });

    if (!data) {
      // Return empty scaffold for a cat that hasn't been saved yet
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(null),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error('get-cat error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to load cat data' }) };
  }
};
