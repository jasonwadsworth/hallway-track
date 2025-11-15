# PWA App Icons

This directory contains the app icons for the HallwayTrak PWA.

## Required Icons

The following PNG icons need to be generated from the SVG source:

- `icon-120x120.png` - iPhone app icon (smaller devices)
- `icon-152x152.png` - iPad app icon
- `icon-167x167.png` - iPad Pro app icon
- `icon-180x180.png` - iPhone app icon
- `icon-512x512.png` - High-resolution icon for manifest

## Generation Instructions

To generate the PNG icons from the SVG source:

1. Use an image editing tool like GIMP, Photoshop, or online converter
2. Open `icon.svg`
3. Export/save as PNG at each required size
4. Ensure the background is opaque (not transparent) for iOS compatibility

## Alternative: Command Line Generation

If you have ImageMagick installed:

```bash
# Navigate to the icons directory
cd frontend/public/icons

# Generate all required sizes
convert icon.svg -resize 120x120 icon-120x120.png
convert icon.svg -resize 152x152 icon-152x152.png
convert icon.svg -resize 167x167 icon-167x167.png
convert icon.svg -resize 180x180 icon-180x180.png
convert icon.svg -resize 512x512 icon-512x512.png
```

## Design Notes

The current icon is a placeholder featuring:
- Black background with white "H" for HallwayTrak
- Connection dots and lines to represent networking
- Simple design that works at small sizes

Replace with actual brand assets when available.