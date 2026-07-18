import os
import math
from PIL import Image, ImageFilter

src_path = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-transparent-72/god_ver_a.png"
dst_path = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-transparent-72/god_ver_a.png"

def clean_god():
    img = Image.open(src_path)
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    width, height = img.size
    
    # Target Cyan background to remove: (0, 188, 212)
    target_r, target_g, target_b = (0, 218, 246) # Sample typical cyan border color from image
    
    pixels = img.load()
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            
            # Distance from cyan
            dist = math.sqrt((r - 30)**2 + (g - 215)**2 + (b - 245)**2)
            
            # Also calculate distance from pure cyan-ish colors
            # (high green and high blue, low red)
            is_cyan = (g > 150 and b > 180 and r < 100)
            
            if dist < 90 or is_cyan:
                # Fade out cyan borders
                if dist < 60:
                    pixels[x, y] = (0, 0, 0, 0)
                else:
                    alpha_factor = (dist - 60) / 30.0
                    alpha_factor = max(0.0, min(1.0, alpha_factor))
                    pixels[x, y] = (r, g, b, int(a * alpha_factor))
                    
    # Smooth the alpha mask
    r_ch, g_ch, b_ch, a_ch = img.split()
    a_ch = a_ch.filter(ImageFilter.GaussianBlur(0.5))
    img_cleaned = Image.merge('RGBA', (r_ch, g_ch, b_ch, a_ch))
    
    img_cleaned.save(dst_path, "PNG")
    print(f"Successfully cleaned chroma key cyan border from God transparent PNG.")

if __name__ == "__main__":
    clean_god()
