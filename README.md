# Peekmoji 🔭 + Timescope 🌍

Two daily browser games. Pure static site: no server, no build step, hosted on GitHub Pages.

- **Peekmoji** (`/`): 6 hidden emojis a day, one per category. Press & hold to look through a spyglass; your score is the seconds you held (+5s per wrong guess). Guessing is typo-tolerant ("coconu", "pepper" count). Solving one auto-advances to the next.
- **Timescope** (`/timescope/`): 5 historical photos a day. Look through the spyglass (−100 points/second), drop a pin on the world map, pick the year. Up to 10,000 points per photo.

Everyone gets the same puzzles each day (picked by date). Progress and stats live in the player's browser.

## Layout
```
index.html, game.js, data.js     Peekmoji (data.js = emoji lists)
shared/common.js                 daily picking, storage, sharing, countdown
shared/spyglass.js               press-and-hold magnifying lens (both games)
timescope/index.html, time.js    Timescope game
timescope/map.js, world.js       offline world map (Natural Earth, public domain)
timescope/photos.js, photos/     generated photo list + images (don't hand-edit photos.js)
tools/                           scripts that build world.js and the photo set
```

## Updating
- **Emoji lists:** edit `data.js`. Changing a list reshuffles that category's schedule.
- **Add Timescope photos:**
  1. `node tools/commons-search.mjs "Golden Gate Bridge 1937 photograph"` to find public-domain candidates on Wikimedia Commons
  2. add entries (title, place, lat, lng, year, fact) to `tools/photos.json`
  3. `node tools/fetch-photos.mjs`, then `powershell -File tools/compress-photos.ps1`, then `node tools/fetch-photos.mjs` again
  4. **look at every new photo** for captions/watermarks that reveal the answer; crop them with `tools/crop-photos.ps1`
- **Difficulty knobs:** `MISS_MS` (game.js), `LOOK_PER_SEC` and the scoring curves (timescope/time.js), lens size/zoom in each `new PK.Spyglass(...)`.
- **Publish:** commit and push to `main`; GitHub Pages redeploys in about a minute.

## Ads
Each page has two empty `.ad-slot` divs and an `ADS:` comment in `<head>`. Paste AdSense code there once approved; empty slots stay hidden.
