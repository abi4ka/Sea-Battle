# Sea Battle

A modern, responsive web application for the classic naval combat game **Sea Battle (Battleship)**, featuring a futuristic radar interface, tactical AI, and cross-device online multiplayer via Supabase Realtime (WebSockets).

Modeled after the architecture, style, and realtime engine of the **Tic-Tac-Toe** project.

---

## Features

- **Dual Combat Modes**:
  - 🤖 **VS Computer (Single Player vs AI)**: Battle against an intelligent tactical AI utilizing a two-phase hunter-killer strategy (parity checkerboard search + directional target tracking along the ship's axis).
  - 🌐 **Online Multiplayer**: Realtime cross-device combat powered by Supabase Realtime (WebSockets over secure port 443) with zero database setup. Direct room creation with 6-character room codes and shareable join URLs (`?room=CODE`).
- **Classic Naval Rules**:
  - Standard 10×10 coordinate grid (Columns A–J, Rows 1–10).
  - Standard fleet armada (10 ships, 20 cells total):
    - 1 × Battleship (4 cells)
    - 2 × Cruisers (3 cells)
    - 3 × Destroyers (2 cells)
    - 4 × Patrol Boats (1 cell)
  - Distance rule: Ships cannot touch horizontally, vertically, or diagonally (minimum 1-cell buffer).
  - **Consecutive Volleys**: Successfully hitting or sinking an enemy ship awards an immediate extra shot!
  - **Automatic Halo Marking**: Surrounding water buffer cells are automatically marked as misses once a ship is sunk.
- **Intuitive Fleet Deployment**:
  - One-click randomized armada deployment ("Random").
  - Manual placement with collision highlighting, orientation toggle via button or `R` key, and click-to-dock ship removal.
- **Web Audio API Sound Engine**:
  - Procedurally synthesized in-browser sound effects: cannon volleys, water splashes, explosive hits, naval alarm upon ship sinking, and victory/defeat fanfares.
  - No external audio files required. Header mute/unmute toggle persisted in `localStorage`.
- **In-Game Reactions**:
  - Interactive emoji reactions (`👍`, `🎯`, `💥`, `😡`, `😂`) floating across screens during online battles.
- **Responsive Layout**:
  - Full support for desktop monitors, tablets, and smartphones (dual radar grids side-by-side or quick-toggle tabs on mobile).

---

## Tech Stack

- **Frontend**: HTML5, Vanilla CSS3 (CSS Variables, Flexbox, CSS Grid, Glassmorphism `backdrop-filter`)
- **Fonts**: Google Fonts (*Outfit*, *Inter*, *JetBrains Mono*)
- **Programming Language**: Vanilla JavaScript (ES6+ Modules & Classes)
- **Networking**: Supabase Realtime (WebSockets via Broadcast & Presence channels)
- **Audio**: Web Audio API (procedural synthesis)
- **Architecture**: Pure static single-page application (ready for GitHub Pages, Netlify, or Vercel)

---

## Configuration

The online multiplayer functionality is powered by Supabase Realtime. Configuration is stored in `config.js`:

```javascript
window.SUPABASE_CONFIG = {
    url: 'https://YOUR_PROJECT_ID.supabase.co',
    anonKey: 'YOUR_ANON_KEY'
};
```

> **Note**: Supabase Realtime Broadcast and Presence run purely in-memory over WebSockets — no database tables or SQL migrations are required.

---

## Local Development

Since this project consists of standard static assets, no compilation or build steps are required.

To run locally:

1. Navigate to the project directory:
   ```bash
   cd Sea-Battle
   ```

2. Start a local HTTP server:
   ```bash
   python3 -m http.server 8000
   ```

3. Open `http://localhost:8000` in your web browser.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
