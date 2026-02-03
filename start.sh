#!/bin/bash

ollama list
node server.js &
open http://127.0.0.1:3000
