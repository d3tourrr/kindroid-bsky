#!/bin/bash

TZ=$(systemsetup -gettimezone | awk '{print $3}')

docker container rm kin-bsky -f
docker build -t kin-bsky .
docker run -d --restart unless-stopped -e TZ="$TZ" --name kin-bsky kin-bsky

