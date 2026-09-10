import os
from PIL import Image

BASE_DIR = r"d:\PROYECTO RED"
OUTPUT_DIR = os.path.join(BASE_DIR, "release-assets", "store_assets")
os.makedirs(OUTPUT_DIR, exist_ok=True)

# 1. ICON: Exactly 512x512 PNG
icon_src = os.path.join(BASE_DIR, "client", "app", "public", "red_icon.png")
icon_out = os.path.join(OUTPUT_DIR, "icon_512.png")
with Image.open(icon_src) as img:
    icon_resized = img.convert("RGBA").resize((512, 512), Image.Resampling.LANCZOS)
    icon_resized.save(icon_out, "PNG", optimize=True)
print(f"[OK] Icon 512x512 saved: {icon_out} ({os.path.getsize(icon_out)} bytes)")

# 2. FEATURE GRAPHIC: Exactly 1024x500 PNG / JPG
banner_src = os.path.join(BASE_DIR, "client", "app", "public", "assets", "red_hero_tactical_mesh.jpg")
banner_out = os.path.join(OUTPUT_DIR, "feature_graphic_1024x500.png")
banner_out_jpg = os.path.join(OUTPUT_DIR, "feature_graphic_1024x500.jpg")
with Image.open(banner_src) as img:
    # Resize with crop to exactly 1024x500
    target_w, target_h = 1024, 500
    orig_w, orig_h = img.size
    scale = max(target_w / orig_w, target_h / orig_h)
    new_w = int(orig_w * scale)
    new_h = int(orig_h * scale)
    resized = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    cropped = resized.crop((left, top, left + target_w, top + target_h))
    cropped.save(banner_out, "PNG", optimize=True)
    cropped.convert("RGB").save(banner_out_jpg, "JPEG", quality=95)
print(f"[OK] Feature Graphic 1024x500 saved: {banner_out}")

# 3. PHONE SCREENSHOTS: 1080x1920 (16:9, ratio 1.77:1, STRICTLY compliant with < 2:1 limit)
phone_screens = [
    ("moto_g22_live.png", "screenshot_phone_1.png"),
    ("swarm_health_hud.png", "screenshot_phone_2.png")
]

for src_name, out_name in phone_screens:
    src_path = os.path.join(BASE_DIR, "client", "app", "public", "assets", src_name)
    out_path = os.path.join(OUTPUT_DIR, out_name)
    with Image.open(src_path) as img:
        target_w, target_h = 1080, 1920
        orig_w, orig_h = img.size
        # Fit image centered in 1080x1920 with subtle dark tactical background
        canvas = Image.new("RGB", (target_w, target_h), (5, 8, 20))
        scale = min(target_w / orig_w, target_h / orig_h)
        scaled_w = int(orig_w * scale)
        scaled_h = int(orig_h * scale)
        resized = img.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
        offset_x = (target_w - scaled_w) // 2
        offset_y = (target_h - scaled_h) // 2
        canvas.paste(resized, (offset_x, offset_y))
        canvas.save(out_path, "PNG", optimize=True)
        print(f"[OK] Phone Screenshot 1080x1920 saved: {out_path} (ratio: {target_h/target_w:.2f}:1)")

# 4. TABLET SCREENSHOTS: 1280x800 (16:10, ratio 1.6:1, strictly compliant)
tablet_screens = [
    ("lenovo_tab_m8_live.png", "screenshot_tablet_1.png"),
    ("tactical_map_cone.png", "screenshot_tablet_2.png")
]

for src_name, out_name in tablet_screens:
    src_path = os.path.join(BASE_DIR, "client", "app", "public", "assets", src_name)
    out_path = os.path.join(OUTPUT_DIR, out_name)
    with Image.open(src_path) as img:
        target_w, target_h = 1280, 800
        canvas = Image.new("RGB", (target_w, target_h), (5, 8, 20))
        orig_w, orig_h = img.size
        scale = min(target_w / orig_w, target_h / orig_h)
        scaled_w = int(orig_w * scale)
        scaled_h = int(orig_h * scale)
        resized = img.resize((scaled_w, scaled_h), Image.Resampling.LANCZOS)
        offset_x = (target_w - scaled_w) // 2
        offset_y = (target_h - scaled_h) // 2
        canvas.paste(resized, (offset_x, offset_y))
        canvas.save(out_path, "PNG", optimize=True)
        print(f"[OK] Tablet Screenshot 1280x800 saved: {out_path} (ratio: {target_w/target_h:.2f}:1)")

print("\n[OK] ALL STORE ASSETS PREPARED WITH 100% SPECIFICATION COMPLIANCE!")
