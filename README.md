<div align="center">

# 🔥 GitHub Roast

**Paste a username. Get roasted. Then glow up.**

Brutally honest, weirdly accurate, and 100% based on your real public repos.
No login. No backend. Nothing stored. Just your repos and a lot of judgment.

[**Live demo**](#) · [How it works](#how-it-works) · [Run locally](#run-locally)

</div>

---

## What it does

Type any GitHub username and GitHub Roast pulls their public profile, reads the
receipts (repos, stars, forks, languages, dead projects, cursed repo names) and
generates a share-ready roast card, plus a **glow-up list** of things they can
actually fix.

Every roast line is triggered by a *real signal* in the data, so it lands as
"how did it know that" instead of a generic fortune cookie. That accuracy is the
whole point: it makes people screenshot it and send it to the exact friend it
describes.

## Why people share it

- **It's about them.** Identity content spreads. A roast of your own GitHub is
  irresistible to post and tag friends in.
- **It's funny and true.** Templated jokes wired to real metrics feel personal.
- **Zero friction.** Runs entirely in the browser. No sign-up, no API key.
- **It gives, not just takes.** The glow-up section turns a laugh into a to-do
  list, so it is useful after the joke lands.

## How it works

```
index.html        markup + share card layout
styles.css        the look (dark, fiery, screenshot-friendly)
roast-engine.js   pure, deterministic roast logic (no network, no keys)
app.js            GitHub fetch, rendering, and PNG export drawn on <canvas>
```

1. `app.js` calls the public GitHub REST API for the user and their repos.
2. `roast-engine.js` scores the profile (1-100, higher = more roastable) and
   builds roast lines from real signals: follower ratios, star drought, fork
   ratio, missing descriptions, stale "graveyard" repos, cursed names, tutorial
   overload, language stereotypes, empty bios, account age vs output, and more.
3. The result renders as a card. "Download card" hand-draws the card onto a
   `<canvas>` so the PNG works even offline.

No data ever leaves the browser except the read-only calls to `api.github.com`.

## Run locally

No build step. Any static server works:

```bash
npx serve .
```

Then open the printed URL. Or just double-click `index.html`.

> The unauthenticated GitHub API allows 60 requests/hour per IP. That is plenty
> for personal use. For a public deployment, proxy requests through a tiny
> serverless function that adds a token.

## Deploy

It is a static site, so it drops onto anything:

- **GitHub Pages:** push and enable Pages on the repo.
- **Vercel / Netlify / Cloudflare Pages:** point at the folder, no config.

## Roadmap ideas

- Optional "extra spicy" mode: bring your own LLM key for a custom roast.
- Compare two users head to head.
- A weekly "most roastable repo" wall of fame.

## License

MIT. Roast responsibly.
