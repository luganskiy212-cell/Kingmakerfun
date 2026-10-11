module.exports = async function handler(req, res) {
  const endpoints = [
    'https://frontend-api-v3.pump.fun/coins/top-runners?limit=5',
    'https://frontend-api-v3.pump.fun/coins/recommended?limit=5',
    'https://pump.fun/api/coins/live'
  ];

  const results = [];

  for (const url of endpoints) {
    try {
      const r = await fetch(url, {
        headers: {
          'accept': 'application/json, text/plain, */*',
          'user-agent': 'KINGMAKER/0.1'
        }
      });
      const text = await r.text();
      let body;
      try { body = JSON.parse(text); }
      catch { body = text.slice(0, 1200); }

      results.push({
        url,
        status: r.status,
        ok: r.ok,
        contentType: r.headers.get('content-type'),
        body
      });
    } catch (e) {
      results.push({url, ok:false, error:String(e.message || e)});
    }
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ok:true, testedAt:new Date().toISOString(), results});
};
