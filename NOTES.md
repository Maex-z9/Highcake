# highcake.xyz — design notes

## concept
a slow accumulation. no navigation, no pages. one infinite feed that grows every few minutes.
every visitor sees the same entries — generated once by ai, stored in cloudflare kv.

## typography
- **Crimson Pro** (serif) — titles. weight 600. generous size (~2rem per entry).
- **Space Mono** (monospace) — everything else. body, meta, status, tags.
- tension between classical editorial and technical.

## color
- `#070709` background (near-black, very slight blue cast)
- `#ddd8cc` primary text (warm off-white, not pure)
- `#9b7d45` gold — dates, accents (shifts subtly over time via style entries)
- `#c8952a` bright gold — newest entry highlight
- `#1c1a14` borders (dark warm)
- `#4a4535` muted — secondary text, tags

## entry anatomy
```
#042                          may 28, 2026
TITLE IN LARGE CRIMSON PRO
──── (rule, extends on hover)
tag1  tag2
body text in space mono, small, muted
```

## interactions
- hover entry: rule extends (2rem→4rem) and turns gold, title lightens
- new entry: slides up from below + fades in, highlighted for 8 seconds
- status dot: breathes slowly in amber (4s cycle)
- share button: copies url, shows "copied." confirmation

## architecture
- cloudflare worker at highcake.maxschuler.workers.dev
- worker generates post/css/html via mistral-7b (hf inference api)
- entries cached in cloudflare workers kv (key: p{i})
- client fetches last 20 entries from kv on load to show ai content
- variable timing: 30% rapid (5–30s), 70% normal (60–480s)
- style entries (deterministic) drift --gold over time

## files
- `index.html` — entire site
- `worker.js` — cloudflare worker (deploy manually to cloudflare dashboard)
- `NOTES.md` — this file
