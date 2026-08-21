# Architecture

PacketHalo separates observation, truth, transport and presentation so each layer can be inspected independently.

## Data flow

1. A provider observes or generates a connection.
2. It normalizes the observation into the TypeScript/Rust `FlowEvent` shape.
3. The protocol boundary rejects forbidden content-like fields and invalid metadata.
4. The local server appends accepted metadata to SQLite and broadcasts it over WebSocket.
5. The Canvas renderer interpolates events into the selected visual grammar.
6. A separate control socket changes settings without restarting the renderer.

The built-in browser simulator can feed the renderer directly. That intentional fast path makes `pnpm dev` beautiful even if the server is still starting, while using the exact same event contract as the server path.

## Monorepo boundaries

`protocol` is the narrow shared truth. `simulator-core` depends on it but knows nothing about React or Canvas. `renderer` consumes immutable events and display settings. The web app schedules sources and presents controls. The server owns retention and remote coordination. Capture providers do not import rendering code.

The Rust agent mirrors the protocol with serializable structs. `scripts/verify-privacy.mjs` inspects both language contracts to prevent prohibited fields from entering either model.

## Time

Every event has an epoch timestamp and duration. The renderer also records a monotonic local `bornAt` time when an event arrives; animation and fading therefore do not jump if the wall clock changes. Simulator IDs, metadata and relative event timing are repeatable for a seed.

## Extensibility

Providers implement a small lifecycle and emit validated events. Geo providers expose local lookup. Render modes share palette and flow primitives, which keeps a new display mode from changing capture behavior. Settings messages are partial patches and take effect on the next animation frame.
