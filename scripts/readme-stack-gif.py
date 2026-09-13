from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "assets" / "copilot-city-stack.gif"
WIDTH, HEIGHT = 1000, 170
FRAMES = 48

TECHNOLOGIES = [
    ("N", "Next.js", "15", "#F4F1E8"),
    ("R", "React", "19", "#61DAFB"),
    ("3", "Three.js", "r186", "#D7BD7B"),
    ("TS", "TypeScript", "5.9", "#5A9BD5"),
    ("TW", "Tailwind", "4", "#38BDF8"),
    ("Z", "Zustand", "5", "#CFA26A"),
    ("V", "Vitest", "3", "#9BCB5A"),
]


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(f"C:/Windows/Fonts/{name}", size)


LABEL = font("segoeuib.ttf", 18)
VERSION = font("segoeui.ttf", 13)
MONO = font("consola.ttf", 18)


def rounded_gradient(draw: ImageDraw.ImageDraw) -> None:
    for y in range(HEIGHT):
        blend = y / max(HEIGHT - 1, 1)
        color = tuple(int(a + (b - a) * blend) for a, b in zip((16, 27, 25), (25, 38, 35)))
        draw.line((0, y, WIDTH, y), fill=color)
    for x in range(0, WIDTH, 32):
        draw.line((x, 0, x, HEIGHT), fill=(215, 189, 123, 10), width=1)


def render_frame(index: int) -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), "#101b19")
    draw = ImageDraw.Draw(image, "RGBA")
    rounded_gradient(draw)

    card_width = 124
    gap = 11
    total = len(TECHNOLOGIES) * card_width + (len(TECHNOLOGIES) - 1) * gap
    origin_x = (WIDTH - total) // 2

    for tech_index, (mark, label, version, accent) in enumerate(TECHNOLOGIES):
        phase = (index / FRAMES) * math.tau - tech_index * 0.42
        lift = round(math.sin(phase) * 5)
        glow = int(22 + 20 * (math.sin(phase) + 1) / 2)
        x = origin_x + tech_index * (card_width + gap)
        y = 25 + lift

        draw.rounded_rectangle(
            (x - 3, y - 3, x + card_width + 3, y + 123),
            radius=20,
            fill=accent + f"{glow:02x}",
        )
        draw.rounded_rectangle(
            (x, y, x + card_width, y + 117),
            radius=17,
            fill="#172521F2",
            outline="#40534DCB",
            width=1,
        )
        draw.rounded_rectangle((x + 39, y + 15, x + 85, y + 61), radius=13, fill=accent + "28")

        bbox = draw.textbbox((0, 0), mark, font=MONO)
        mark_width = bbox[2] - bbox[0]
        draw.text((x + (card_width - mark_width) / 2, y + 25), mark, font=MONO, fill=accent)

        bbox = draw.textbbox((0, 0), label, font=LABEL)
        label_width = bbox[2] - bbox[0]
        draw.text((x + (card_width - label_width) / 2, y + 69), label, font=LABEL, fill="#F1EFE7")

        version_text = f"v{version}" if version[0].isdigit() else version
        bbox = draw.textbbox((0, 0), version_text, font=VERSION)
        version_width = bbox[2] - bbox[0]
        draw.text((x + (card_width - version_width) / 2, y + 94), version_text, font=VERSION, fill="#9FB0A9")

    return image


OUTPUT.parent.mkdir(parents=True, exist_ok=True)
images = [render_frame(index) for index in range(FRAMES)]
images[0].save(
    OUTPUT,
    save_all=True,
    append_images=images[1:],
    duration=75,
    loop=0,
    optimize=True,
    disposal=2,
)
print(f"Generated {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)")
