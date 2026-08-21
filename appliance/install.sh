#!/usr/bin/env sh
set -eu

PROJECT_DIR=/opt/packethalo
if [ "$(id -u)" -ne 0 ]; then
  echo "Run this installer with sudo." >&2
  exit 1
fi
if [ ! -f "$PROJECT_DIR/.env.appliance" ]; then
  echo "Create $PROJECT_DIR/.env.appliance from appliance/.env.appliance.example first." >&2
  exit 1
fi
install -m 0644 "$PROJECT_DIR/appliance/packethalo.service" /etc/systemd/system/packethalo.service
install -d -m 0755 /etc/xdg/autostart
install -m 0644 "$PROJECT_DIR/appliance/packethalo-kiosk.desktop" /etc/xdg/autostart/packethalo-kiosk.desktop
chmod 0600 "$PROJECT_DIR/.env.appliance"
systemctl daemon-reload
systemctl enable --now packethalo.service
echo "PacketHalo appliance installed. Reboot to enter the fullscreen observatory."
