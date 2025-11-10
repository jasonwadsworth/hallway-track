#!/bin/bash

DIR="infrastructure/assets/link-type-images"

for file in "$DIR"/*.svg; do
  base=$(basename "$file" .svg)
  echo "Converting $base..."
  qlmanage -t -s 128 -o "$DIR" "$file" > /dev/null 2>&1
  if [ -f "$DIR/${base}.svg.png" ]; then
    mv "$DIR/${base}.svg.png" "$DIR/${base}.png"
    echo "Created ${base}.png"
  fi
done

echo "Conversion complete!"
ls -lh "$DIR"/*.png
