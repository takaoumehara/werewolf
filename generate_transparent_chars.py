import os
import math
from PIL import Image, ImageFilter

src_dir = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72-a"
dst_dir = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-transparent-72"

os.makedirs(dst_dir, exist_ok=True)

roles = [
    "dictator", "knights", "double", "counselor", "necromancer",
    "trapper", "citizen", "prophet", "bodyguard", "twins",
    "magician", "hunter", "tough_guy", "spy", "betrayal_twin",
    "werewolf", "traitor", "betrayer", "werewolf_child", "android",
    "lone_wolf", "god", "lovers", "mysterious_fox"
]

def extract_character_rgba(src_path, dst_path):
    img = Image.open(src_path)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    width, height = img.size
    
    # 1. Detect background color at top-left corner
    bg_color = img.getpixel((15, 15))
    bg_r, bg_g, bg_b = bg_color
    
    # Create output RGBA image
    rgba_img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    rgba_data = rgba_img.load()
    img_data = img.load()
    
    # Extract alpha mask color distance
    for y in range(height):
        for x in range(width):
            r, g, b = img_data[x, y]
            # Euclidean distance
            dist = math.sqrt((r - bg_r)**2 + (g - bg_g)**2 + (b - bg_b)**2)
            
            # Smooth thresholding
            if dist < 22:
                alpha = 0
            elif dist > 45:
                alpha = 255
            else:
                alpha = int((dist - 22) / (45 - 22) * 255)
                
            rgba_data[x, y] = (r, g, b, alpha)
            
    # Apply a tiny blur on the alpha channel only to keep outlines smooth
    r_ch, g_ch, b_ch, a_ch = rgba_img.split()
    a_ch = a_ch.filter(ImageFilter.GaussianBlur(0.8))
    rgba_img = Image.merge('RGBA', (r_ch, g_ch, b_ch, a_ch))
    
    rgba_img.save(dst_path, "PNG")
    print(f"Saved transparent character: {dst_path}")

def main():
    print("Generating transparent character PNGs...")
    for r in roles:
        src = os.path.join(src_dir, f"{r}_ver_a.png")
        dst = os.path.join(dst_dir, f"{r}_ver_a.png")
        if os.path.exists(src):
            extract_character_rgba(src, dst)
        else:
            print(f"File not found: {src}")
    print("--- Finished generating transparent characters ---")

if __name__ == "__main__":
    main()
