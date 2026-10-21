#!/bin/sh
# Run after the renderer: adds the banner at the bottom, drops the credit badge, tightens spacing.
set -e
sed -i '/metawka.github.io/d' README.md
rm -f assets/credit-*.svg
sed -i '$i <img src="banner.png" width="100%" alt="Serpantinum">' README.md
sed -i '/^$/d' README.md
