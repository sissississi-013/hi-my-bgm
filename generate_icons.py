#!/usr/bin/env python3
"""
Generate placeholder PNG icons for HI MY BGM extension
Creates simple gradient circle icons in 3 sizes
"""

try:
    from PIL import Image, ImageDraw
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False
    print("PIL/Pillow not available. Install with: pip3 install Pillow")
    print("Generating minimal placeholder PNGs instead...")

import os

def create_gradient_circle_icon(size, output_path):
    """Create a simple circular icon with gradient background"""
    if not PIL_AVAILABLE:
        # Create a minimal valid PNG (1x1 magenta pixel)
        # This is a valid PNG that Chrome will accept
        minimal_png = bytes([
            0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,  # PNG signature
            0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,  # IHDR chunk
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,  # 1x1 size
            0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
            0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41,  # IDAT chunk
            0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00,
            0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xDD,
            0x8D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,  # IEND chunk
            0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
        ])
        with open(output_path, 'wb') as f:
            f.write(minimal_png)
        return

    # Create image with alpha channel
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Draw gradient background circle
    center = size // 2
    radius = size // 2 - 2

    # Simple solid color for now (cyan/blue gradient effect)
    # Start color: cyan #00bcd4
    # End color: purple #764ba2
    for i in range(radius, 0, -1):
        # Interpolate between cyan and purple
        t = i / radius
        r = int(0x00 * t + 0x76 * (1 - t))
        g = int(0xbc * t + 0x4b * (1 - t))
        b = int(0xd4 * t + 0xa2 * (1 - t))

        draw.ellipse(
            [center - i, center - i, center + i, center + i],
            fill=(r, g, b, 255)
        )

    # For larger icons, add a simple face
    if size >= 48:
        # Eyes
        eye_size = max(2, size // 16)
        eye_y = int(center * 0.8)
        left_eye_x = int(center * 0.7)
        right_eye_x = int(center * 1.3)

        draw.ellipse(
            [left_eye_x - eye_size, eye_y - eye_size,
             left_eye_x + eye_size, eye_y + eye_size],
            fill=(255, 255, 255, 255)
        )
        draw.ellipse(
            [right_eye_x - eye_size, eye_y - eye_size,
             right_eye_x + eye_size, eye_y + eye_size],
            fill=(255, 255, 255, 255)
        )

        # Simple smile (arc approximated by line for simplicity)
        if size >= 128:
            mouth_width = int(center * 0.6)
            mouth_y = int(center * 1.3)
            draw.arc(
                [center - mouth_width, mouth_y - 10,
                 center + mouth_width, mouth_y + 20],
                start=0, end=180,
                fill=(255, 255, 255, 255), width=3
            )

    # Save
    img.save(output_path, 'PNG')
    print(f"✓ Created {size}x{size} icon: {output_path}")

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    assets_dir = os.path.join(script_dir, 'assets')

    print("Generating placeholder icons for HI MY BGM...")
    print(f"Output directory: {assets_dir}")

    if not PIL_AVAILABLE:
        print("\n⚠️  Pillow not installed - generating minimal placeholder PNGs")
        print("These will allow the extension to load but won't look good.")
        print("Install Pillow for better icons: pip3 install Pillow\n")

    # Generate icons in 3 sizes
    sizes = [
        (16, 'icon16.png'),
        (48, 'icon48.png'),
        (128, 'icon128.png')
    ]

    for size, filename in sizes:
        output_path = os.path.join(assets_dir, filename)
        create_gradient_circle_icon(size, output_path)

    print("\n✓ Icon generation complete!")
    if not PIL_AVAILABLE:
        print("\n⚠️  For better quality icons:")
        print("1. Install Pillow: pip3 install Pillow")
        print("2. Run this script again")
        print("3. Or use the SVG template in assets/ICON_INSTRUCTIONS.md")

if __name__ == '__main__':
    main()
