var CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

var HF_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3';

addEventListener('fetch', function(event) {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }
  if (request.method !== 'GET') {
    return new Response('method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  var url = new URL(request.url);
  var i = parseInt(url.searchParams.get('i'));
  if (isNaN(i) || i < 0) {
    return new Response('bad request', { status: 400, headers: CORS_HEADERS });
  }

  var cached = await POSTS.get('p' + i);
  if (cached) {
    return new Response(cached, {
      headers: Object.assign({}, CORS_HEADERS, { 'Content-Type': 'application/json' }),
    });
  }

  var systemPrompt = [
    'You are highcake.xyz — a living website that grows and changes over time.',
    'You have been running for ' + i + ' entries. You maintain yourself.',
    'You can do exactly one of three things:',
    '- Write something: {"type":"post","title":"...","paragraphs":["..."],"tags":["..."]}',
    '- Change your appearance: {"type":"css","rules":"..."}',
    '- Add to your body: {"type":"html","html":"..."}',
    'Output only valid JSON. No explanation. No script tags.',
  ].join(' ');

  var userPrompt = 'Entry ' + i + '. Do whatever feels right.';

  var hfRes = await fetch('https://api-inference.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + HF_TOKEN,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: HF_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 350,
      temperature: 1.0,
    }),
  });

  if (!hfRes.ok) {
    return new Response('hf error ' + hfRes.status, { status: 502, headers: CORS_HEADERS });
  }

  var hfJson = await hfRes.json();
  var choice = hfJson.choices && hfJson.choices[0];
  var text = (choice && choice.message && choice.message.content || '').trim();
  var match = text.match(/\{[\s\S]*\}/);
  var data = null;
  if (match) {
    try { data = JSON.parse(match[0]); } catch (e) {}
  }

  if (!data) {
    data = { type: 'post', title: 'entry ' + i, paragraphs: ['.'], tags: ['log'] };
  }

  var entry;
  if (data.type === 'css') {
    var rules = String(data.rules || '')
      .replace(/display\s*:\s*none/gi, 'display:block')
      .replace(/visibility\s*:\s*hidden/gi, 'visibility:visible')
      .replace(/opacity\s*:\s*0([^.])/gi, 'opacity:0.01$1');
    entry = { i: i, type: 'ai_css', rules: rules };
  } else if (data.type === 'html') {
    var safe = String(data.html || '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\son\w+="[^"]*"/gi, '');
    entry = { i: i, type: 'ai_html', html: safe };
  } else {
    var paras = Array.isArray(data.paragraphs)
      ? data.paragraphs.map(function(p) { return String(p); })
      : [String(data.paragraphs || '...')];
    var tags = Array.isArray(data.tags)
      ? data.tags.map(function(t) { return String(t).toLowerCase().trim(); })
      : ['entry'];
    entry = {
      i: i,
      type: 'post',
      title: String(data.title || 'entry ' + i).toLowerCase().replace(/["'.]/g, '').trim(),
      paras: paras,
      tags: tags,
    };
  }

  var result = JSON.stringify(entry);
  await POSTS.put('p' + i, result);
  return new Response(result, {
    headers: Object.assign({}, CORS_HEADERS, { 'Content-Type': 'application/json' }),
  });
}
