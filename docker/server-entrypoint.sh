#!/bin/sh
set -eu

if [ "$(id -u)" -eq 0 ]; then
  chown -R node:node /data
  exec su-exec node "$@"
fi
exec "$@"
