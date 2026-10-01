# Doodle Office 🏢

A portfolio you can walk around in: a multiplayer virtual office with doodle-style characters. Visitors in the same session see each other move and can chat. The owner can redecorate it Sims-style.

```bash
bun install
bun run dev        # http://localhost:3000
```

## Controls
WASD / arrows, or click/tap to walk (the character routes around walls and furniture) · Shift run · Space jump · drag to orbit · wheel / pinch zoom · **E** or tap the prompt to interact · Enter chat · 1 wave · 2 dance · **V** switch between 3rd person and iso · **B** build mode.
On touch screens you get a joystick and a jump button.

## Where things live
| File | What |
|---|---|
| `src/data.js` | **Your content**: profile, projects, experience, contact |
| `src/furniture.js` | Furniture catalog (incl. NPC "office buddies" and floor labels, whose text is editable in build mode) + default office layout |
| `src/character.js` | Chibi character builder + customization options |
| `src/main.js` | Scene, cameras, movement, multiplayer, build mode |
| `src/path.js` | A* grid path-finding for click-to-walk |
| `server.ts` | Bun server: serves the page + WebSocket sessions + layout saving |

## Sessions
`/?s=anything` puts you in a separate room. Only people in the same session see each other. Everyone shares the same office layout.

## Build mode (owner only saves)
Press **B**. Tools:
- **Select**: pick furniture from the catalog, then place, move, rotate (R), copy, recolor, delete (Del), edit sign text, or swap a wall for a window
- **Paint**: color floor tiles; ↺ resets a tile, 🌱 removes it so the floor can take any shape
- **Wall**: drag along grid lines to draw walls
- **Room**: drag a rectangle to get four walls plus a painted floor
- **Erase wall**: drag along walls to knock them down (for doorways)
- **Lot size**: grow or shrink the buildable area
- **Undo / Redo**: Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z

**Save** asks for the owner key, which you set with `OWNER_KEY` (the default is `dev`, so change it before deploying). Saved layouts go to `layout.json` and are pushed live to everyone. Visitors can play in build mode too, but their changes stay on their own screen.

## Deploy
You need a host that runs Bun with WebSockets and a persistent disk for `layout.json`: Railway, Fly.io, Render or a VPS.
```bash
OWNER_KEY=some-long-secret PORT=3000 bun run start
```
Vercel's serverless functions can't host the WebSocket server.

## Tests
`bun test` runs the path-finding tests plus server checks (junk messages, session isolation, owner key, concurrent saves).
