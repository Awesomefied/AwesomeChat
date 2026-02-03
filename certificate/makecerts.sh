#!/bin/bash
DIR=$(cd "$(dirname "$0")" && pwd)
WIFI=$(ipconfig getifaddr en0)
ETHERNET=$(ipconfig getifaddr en1)
mkcert -cert-file "$DIR/cert.pem" -key-file "$DIR/key.pem" localhost 127.0.0.1 $WIFI $ETHERNET
