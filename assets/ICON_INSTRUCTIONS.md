# Icon Generation Instructions

The placeholder icon files (`icon16.png`, `icon48.png`, `icon128.png`) need to be replaced with actual PNG images.

## Quick Option: Use SVG Template

Here's a simple SVG you can convert to PNG using an online tool:

```svg
<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#00bcd4;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background circle -->
  <circle cx="64" cy="64" r="60" fill="url(#bgGrad)"/>

  <!-- Face - happy expression -->
  <circle cx="48" cy="56" r="6" fill="white"/>
  <circle cx="80" cy="56" r="6" fill="white"/>
  <path d="M 40 75 Q 64 90 88 75" stroke="white" stroke-width="4" fill="none" stroke-linecap="round"/>
</svg>
```

## Tools for Conversion

### Online (Free)
1. **CloudConvert** - https://cloudconvert.com/svg-to-png
   - Upload the SVG above
   - Generate 128x128, 48x48, and 16x16 versions

2. **Favicon Generator** - https://www.favicon-generator.org/
   - Upload a square image
   - Automatically generates all sizes

3. **RealFaviconGenerator** - https://realfavicongenerator.net/
   - Comprehensive icon generator
   - Handles all sizes and formats

### Design Tools
- **Figma** (recommended): Create 128x128 artboard, export as PNG at 1x, 0.375x, 0.125x
- **Sketch**: Similar to Figma
- **GIMP** (free): Open SVG, scale, export
- **Inkscape** (free): Vector editor, export to PNG

## Design Guidelines

**Theme**: Friendly focus companion

**Elements**:
- Circular bubble shape
- Gradient: Cyan (#00bcd4) to Purple (#764ba2)
- Simple happy face (eyes + smile)
- Soft, rounded style
- High contrast for visibility at small sizes

**Colors**:
- Primary: Cyan #00bcd4, Blue #667eea
- Secondary: Purple #764ba2
- Accent: White for face elements

**Sizes**:
- 16x16: Simplified (just circle + minimal face)
- 48x48: Standard detail
- 128x128: Full detail with subtle effects

## Quick Terminal Commands (if you have ImageMagick)

```bash
# Convert the SVG template above to all sizes
# Save SVG as icon-template.svg first

convert icon-template.svg -resize 128x128 icon128.png
convert icon-template.svg -resize 48x48 icon48.png
convert icon-template.svg -resize 16x16 icon16.png
```

## Alternative: Use Emoji

For quick testing, you can create simple PNG icons from emoji:

1. Take a screenshot of 😄 emoji at large size
2. Crop to square
3. Scale to 128x128, 48x48, 16x16
4. Add gradient background using any image editor

Not recommended for production but works for development!

---

**Need help?** Open an issue on GitHub or use the design tools above.
