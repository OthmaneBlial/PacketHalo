## What changed

Describe the user-visible result and why it belongs in PacketHalo's core experience.

## Privacy and security

- [ ] No payload, content, credential, token, or private fixture was added.
- [ ] New or changed event fields passed an explicit privacy review.
- [ ] Network exposure remains loopback-only unless authenticated LAN mode is intentional.

## Validation

- [ ] `pnpm verify`
- [ ] `pnpm test:e2e`
- [ ] `docker compose up -d --build` and live health checks, when container paths changed
- [ ] Keyboard, reduced-motion, desktop, and phone behavior checked, when UI paths changed

List exact results and any intentionally unverified platform behavior.
