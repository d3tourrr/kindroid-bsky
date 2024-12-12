#!/bin/sh

if [ -n "$TZ" ]; then
  ln -sf /usr/share/zoneinfo/$TZ /etc/localtime
  echo $TZ > /etc/timezone
else
  echo "TZ environment variable not set, using default (UTC)"
fi

exec "$@"
