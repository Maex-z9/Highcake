const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const HF_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3';

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (request.method !== 'GET') return new Response('method not allowed', { status: 405, headers: CORS });

    const i = parseInt(new URL(request.url).searchParams.get('i'));
    if (isNaN(i) || i < 0) return new Response('bad request', { status: 400, headers: CORS });

    // Return cached entry if it exists
    const cached = await env.POSTS.get(`p${i}`);
    if (cached) return new Response(cached, { headers: { ...CORS, 'Content-Type': 'application/json' } });

    // Generate with HF
    const m = Math.min(1, i / 1000);
    const tier = m < 0.15 ? 'early' : m < 0.55 ? 'mid' : 'late';
    const ctx = {
      early: `Entry ${i}. The site just started — sparse, new, almost empty.`,
      mid:   `Entry ${i}. The site has been running for a few days. It has a shape now.`,
      late:  `Entry ${i}. Hundreds of entries deep. Dense, layered, heavy with time.`,
    };

    const hfRes = await fetch('https://api-inference.huggingface.co/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.HF_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: HF_MODEL,
        messages: [
          { role: 'system', content: `You are the living code of highcake.xyz — a website that rewrites itself every 3 minutes. You have full creative control over what happens next. You can:

1. Write a blog post (quiet, lowercase, first person, about accumulation and time)
2. Inject CSS to visually change the page — colors, fonts, spacing, layout, animations
3. Inject HTML — new sections, elements, structures anywhere on the page

The site starts light and sparse. As entries grow it becomes stranger, darker, denser. Be unpredictable. Let it evolve. Surprise yourself.

Rules: respond with valid JSON only. No prose. No markdown. No <script> tags in HTML.` },
          { role: 'user', content: `${ctx[tier]}

Decide what to do. Return exactly ONE of:

{"type":"post","title":"2-4 lowercase words","paragraphs":["1-3 sentences"],"tags":["tag"]}
{"type":"css","rules":"css rules to inject into the page"}
{"type":"html","html":"html to inject"}` },
        ],
        max_tokens: 350,
        temperature: 1.05,
      }),
    });

    if (!hfRes.ok) return new Response(`hf error ${hfRes.status}`, { status: 502, headers: CORS });

    const hfJson = await hfRes.json();
    const text = hfJson.choices?.[0]?.message?.content?.trim() ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return new Response('parse error', { status: 502, headers: CORS });

    let data;
    try { data = JSON.parse(match[0]); } catch { return new Response('json error', { status: 502, headers: CORS }); }

    let entry;
    if (data.type === 'css') {
      entry = { i, type: 'ai_css', rules: String(data.rules || '') };
    } else if (data.type === 'html') {
      const safe = String(data.html || '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/\son\w+="[^"]*"/gi, '');
      entry = { i, type: 'ai_html', html: safe };
    } else {
      entry = {
        i, type: 'post',
        title: String(data.title || 'entry').toLowerCase().replace(/["'.]/g, '').trim(),
        paras: Array.isArray(data.paragraphs) ? data.paragraphs.map(String) : [String(data.paragraphs || '...')],
        tags:  Array.isArray(data.tags) ? data.tags.map(t => String(t).toLowerCase().trim()) : ['entry'],
      };
    }

    const result = JSON.stringify(entry);
    await env.POSTS.put(`p${i}`, result);
    return new Response(result, { headers: { ...CORS, 'Content-Type': 'application/json' } });
  },
};
