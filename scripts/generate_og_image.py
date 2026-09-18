"""
Generates public/og-image.png — a simple, on-brand placeholder social-share
image (1200x630, matching what index.html's commented-out og:image tag
expects). Not a design tool output, just enough to close the "no social
preview image at all" gap. Swap for a real designed version whenever
there's time for one; re-run with `python3 scripts/generate_og_image.py`
if brand colors change first.
"""
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630
INK = "#1A1712"
YELLOW = "#F5B700"
PAPER = "#FAF9F5"
GREEN = "#1C6B45"

img = Image.new("RGB", (W, H), PAPER)
draw = ImageDraw.Draw(img)

BORDER = 14
draw.rectangle([BORDER, BORDER, W - BORDER, H - BORDER], outline=INK, width=BORDER)

# Billboard icon (same shape as public/favicon.svg), scaled up, upper-left.
icon_x, icon_y, icon_s = 90, 110, 150
draw.rounded_rectangle([icon_x, icon_y, icon_x + icon_s, icon_y + icon_s], radius=20, fill=INK)
sign_pad = 28
draw.rectangle(
    [icon_x + sign_pad, icon_y + 34, icon_x + icon_s - sign_pad, icon_y + icon_s - 44],
    outline=INK, width=4, fill=YELLOW,
)
leg_y0, leg_y1 = icon_y + icon_s - 44, icon_y + icon_s - 14
draw.line([icon_x + 46, leg_y0, icon_x + 46, leg_y1], fill=YELLOW, width=9)
draw.line([icon_x + icon_s - 46, leg_y0, icon_x + icon_s - 46, leg_y1], fill=YELLOW, width=9)

bold = ImageFont.truetype("/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf", 74)
regular = ImageFont.truetype("/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf", 34)

draw.text((90, 300), "CHATSCHED", font=bold, fill=INK)
draw.text((90, 400), "Turn any page into a billboard.", font=regular, fill=INK)

# Small accent bar, matching the site's use of a solid green rule elsewhere.
draw.rectangle([90, 460, 90 + 520, 468], fill=GREEN)
draw.text((90, 500), "Book real local audiences from R100/post — Cape Town pilot", font=regular, fill="#4A4335")

img.save("/home/claude/work/public/og-image.png")
print("Saved og-image.png:", img.size)
