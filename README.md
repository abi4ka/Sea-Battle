# Sea Battle

A modern, responsive web application for playing classic naval combat (Battleship) locally against tactical AI or online across devices via Supabase Realtime (WebSockets).

## Features

- **Game Modes**: Single Player against an intelligent tactical AI (two-phase parity search and axis tracking) and Online Multiplayer across separate devices.
- **Cross-Network Realtime Multiplayer**: Connects players across networks via Supabase Realtime (WebSockets on secure port 443) with zero database setup required.
- **Direct Link Sharing**: Room creation generates a 6-character room code and a direct join URL (`?room=CODE`).
- **Classic Naval Rules**: Standard 10x10 coordinate grid, 10-ship armada, 1-cell distance buffer rule, consecutive turns on hit, and automatic halo marking around sunk ships.
- **Fleet Deployment**: Fast one-click randomized deployment or manual dock placement with collision preview and keyboard rotation (`R`).
- **Tactile Audio Feedback**: Minimalist haptic interface clicks and taps synthesized via the Web Audio API with zero external audio assets.
- **Pure Static Architecture**: Runs completely in the browser with no build steps, making it ideal for hosting on GitHub Pages.

## Tech Stack

- **Frontend**: HTML5, Vanilla CSS3 (CSS Variables, Flexbox, Responsive Grid)
- **Programming Language**: JavaScript (ES6+)
- **Networking**: Supabase Realtime (WebSockets via Broadcast & Presence channels)
- **Audio**: Web Audio API (synthesized tactile UI sounds)

## Configuration

The online multiplayer functionality is powered by Supabase Realtime. Configuration is stored in `config.js`:

```javascript
window.SUPABASE_CONFIG = {
    url: 'https://YOUR_PROJECT_ID.supabase.co',
    anonKey: 'YOUR_ANON_KEY'
};
```

> **Note**: Supabase Realtime Broadcast and Presence run purely in-memory over WebSockets — no database tables or SQL migrations are required.

## Local Development

Since this project consists of standard static assets, no compilation or build steps are required.

To run locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/abi4ka/Sea-Battle.git
   cd Sea-Battle
   ```

2. Start a local HTTP server:
   ```bash
   python -m http.server 8000
   ```

3. Open `http://localhost:8000` in your web browser.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
