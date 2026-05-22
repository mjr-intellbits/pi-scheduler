# pi-web scheduling demo

A React + Vite demo app with a pi-powered assistant for employee scheduling.

## Development

```bash
bun install
bun run dev
```

The app runs a Vite frontend and a local Bun/Express WebSocket server that embeds pi via `@earendil-works/pi-coding-agent`.

## Build

```bash
bun run build
```

This produces:

- `dist/` static frontend
- `dist-server/` local Node/Bun server

## Deployment note

The assistant backend uses the pi SDK and Node/Bun server APIs. Cloudflare Pages can host the static frontend, but the pi assistant WebSocket backend must run separately on a Node/Bun-compatible host unless it is rewritten for Cloudflare Workers.
