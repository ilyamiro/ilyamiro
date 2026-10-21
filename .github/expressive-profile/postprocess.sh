#!/bin/sh
# Run after the renderer: adds the banner at the top and bottom, drops the credit badge, tightens spacing.
set -e
sed -i '/metawka.github.io/d' README.md
rm -f assets/credit-*.svg
sed -i '1a <img src="banner.png" width="100%" alt="Serpantinum">' README.md
sed -i '$i <img src="banner.png" width="100%" alt="Serpantinum">' README.md
sed -i '/^$/d' README.md
