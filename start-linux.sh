#!/bin/bash

TZ=$(timedatectl show --property=Timezone --value)

docker container rm kin-bsky -f
docker build -t kin-bsky .
docker run -d --restart unless-stopped -e TZ="$TZ" --name kin-bsky kin-bsky

