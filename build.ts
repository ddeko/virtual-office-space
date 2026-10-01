// Static build for hosts like Vercel: bundles index.html + JS/CSS into dist/.
// Vercel can't run the WebSocket server, so point the client at wherever server.ts runs:
//   OFFICE_WS_URL=wss://your-office.up.railway.app bun run build
const wsUrl = process.env.OFFICE_WS_URL || "";
if (!wsUrl) console.warn("OFFICE_WS_URL not set: the site will look for the WebSocket server on its own domain.");

const out = await Bun.build({
  entrypoints: ["./index.html"],
  outdir: "dist",
  minify: true,
  define: { OFFICE_WS_URL: JSON.stringify(wsUrl.replace(/\/+$/, "")) },
});
if (!out.success) {
  for (const log of out.logs) console.error(log);
  process.exit(1);
}
console.log(`Built ${out.outputs.length} files into dist/`);
