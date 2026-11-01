"""Generate an original DMT Windows icon (requires Pillow)."""
from pathlib import Path
from PIL import Image, ImageDraw
root = Path(__file__).resolve().parents[1]
image = Image.new('RGBA', (256, 256), (0, 0, 0, 0))
d = ImageDraw.Draw(image)
d.rounded_rectangle((8, 8, 248, 248), radius=56, fill='#173b50')
d.rounded_rectangle((40, 54, 184, 158), radius=22, fill='#48c9b0')
d.polygon([(62, 147), (62, 184), (103, 151)], fill='#48c9b0')
d.rounded_rectangle((89, 101, 217, 192), radius=18, fill='#ffffff')
d.polygon([(163, 181), (198, 213), (198, 178)], fill='#ffffff')
d.line([(111, 125), (193, 125)], fill='#173b50', width=10)
d.line([(111, 148), (179, 148)], fill='#173b50', width=10)
d.line([(111, 171), (160, 171)], fill='#173b50', width=10)
out = root / 'build' / 'icons' / 'translator'
out.mkdir(parents=True, exist_ok=True)
image.save(out / 'icon.png')
image.save(out / 'icon.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])
