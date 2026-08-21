# Raspberry Pi appliance mode

PacketHalo can boot straight into a projector-safe fullscreen display. The appliance uses the same Docker images as desktop mode; no separate cloud service exists.

## Install

1. Install Raspberry Pi OS 64-bit, Docker, Docker Compose v2, and Chromium.
2. Clone PacketHalo to `/opt/packethalo`.
3. Copy `.env.appliance.example` to `.env.appliance`, generate a long random token, and restrict the file to root.
4. Run `sudo ./appliance/install.sh`.

The display opens `http://127.0.0.1:8080` at graphical login. Its metadata stream is proxied internally, so the control token is never exposed to the browser. The phone control surface is available on the Pi's LAN address at port `8081`; only the authenticated control socket can change settings. Port `8080` remains loopback-only.

Projector rotation and reduced-motion controls remain live. A keyboard is not required after installation.
