# Peekmoji 👀

A daily hidden-emoji puzzle. Tap to peek, guess in as few peeks as possible, share your score.
Pure static site — no server, no build step. Three files: `index.html`, `data.js`, `game.js`.

## Go live (free)
1. **Cloudflare Pages** (or Netlify): create a project → "Upload assets" → drag this folder in.
   GitHub Pages works too: push the folder to a repo → Settings → Pages.
2. Add your custom domain in the host's dashboard and follow its DNS instructions.
3. The share link uses whatever domain the site is served from — nothing to change.

## Before launch
- **Puzzle #1 date:** `EPOCH` at the top of `game.js` (currently Sept 14, 2026). Set it to launch day.
- **Emoji lists:** `data.js`. Editing a category's list reshuffles its schedule, so finalize before launch.
- **Difficulty:** `RADIUS` in `game.js` (peek circle size, default `0.1` = 10% of the board).

## Ads
- Apply for Google AdSense once the site is live with your domain.
- When approved: paste the AdSense `<script>` in `<head>` (marked `ADS:`), and paste ad units inside
  `#ad-top` / `#ad-bottom` in `index.html`. Empty slots stay hidden automatically.
- Alternative: submit the game to CrazyGames / Poki — they host it and share ad revenue.

## Growth ideas
- Post screen recordings of close calls ("got it in 1 peek") on TikTok/Reels/Shorts.
- Share text is Wordle-style emoji rows — that's the viral loop; keep it short.
