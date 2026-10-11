module.exports = async function handler(req, res) {
  try {
    const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
    const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    if (!url || !key) throw new Error('Supabase environment variables are missing');

    const r = await fetch(`${url}/rest/v1/tokens?select=mint,creator,symbol,market_cap_usd,volume_24h_usd&order=created_at.desc&limit=3`, {
      headers: { apikey: key, authorization: `Bearer ${key}`, accept: 'application/json' }
    });
    const body = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(body?.message || `Supabase HTTP ${r.status}`);
    return res.status(200).json({ ok: true, service: 'KINGMAKER DB', rows: body });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
};
