# Troubleshooting

## `pnpm` is not installed

Install pnpm 10 with `npm install --global pnpm@10.15.0`, then rerun `pnpm install`.

## The screen is alive but no real flows appear

The simulator intentionally remains active by default. Check `http://127.0.0.1:8787/health`, then start the Linux agent on a Linux host. macOS and Windows real-host providers are not yet implemented.

## The phone controller is offline

The default development profile is loopback-only and is not reachable from another device. Use authenticated appliance/LAN mode, set a long `PACKETHALO_CONTROL_TOKEN`, and enter `ws://PI_ADDRESS:8787/control` plus that token on the phone.

## LAN mode refuses to start

This is a safety gate. A non-loopback `PACKETHALO_HOST` requires `PACKETHALO_CONTROL_TOKEN`. Do not use the Docker-only container-loopback escape hatch for LAN exposure.

## Rendering is slow

Choose Ambient mode, lower particles and afterglow, enable reduced motion, close DevTools and test at 1080p. The health panel should distinguish a low FPS from a delayed source.

## SQLite cannot open

Set `PACKETHALO_DATABASE` to a writable local path. Avoid network filesystems; the store uses WAL mode.
