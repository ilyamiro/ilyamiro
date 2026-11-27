#!/bin/sh
# Run after the renderer: adds the banner at the bottom, drops the credit badge, tightens spacing,
# and injects the animated Serpantinum snake into the hero & socials SVGs.
set -e
sed -i '/metawka.github.io/d' README.md
rm -f assets/credit-*.svg
sed -i '$i <img src="banner.png" width="100%" alt="Serpantinum">' README.md
sed -i '/^$/d' README.md
node .github/expressive-profile/inject-snake.mjs
