import os
import math
from PIL import Image, ImageFilter

src_path = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72-a/magician_ver_a.png"
dst_path = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-transparent-72/magician_ver_a.png"

def adjust_magician():
    if not os.path.exists(src_path):
        print(f"Error: Original magician image not found: {src_path}")
        return
        
    img = Image.open(src_path)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    width, height = img.size
    
    # 1. Detect background color at top-left corner
    bg_color = img.getpixel((15, 15))
    bg_r, bg_g, bg_b = bg_color
    
    # 2. Extract character to RGBA
    rgba_img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    rgba_data = rgba_img.load()
    img_data = img.load()
    
    for y in range(height):
        for x in range(width):
            r, g, b = img_data[x, y]
            dist = math.sqrt((r - bg_r)**2 + (g - bg_g)**2 + (b - bg_b)**2)
            
            if dist < 22:
                alpha = 0
            elif dist > 45:
                alpha = 255
            else:
                alpha = int((dist - 22) / (45 - 22) * 255)
                
            rgba_data[x, y] = (r, g, b, alpha)
            
    # Apply blur to alpha to keep borders clean
    r_ch, g_ch, b_ch, a_ch = rgba_img.split()
    a_ch = a_ch.filter(ImageFilter.GaussianBlur(0.8))
    char_extracted = Image.merge('RGBA', (r_ch, g_ch, b_ch, a_ch))
    
    # 3. Paste the character onto a clean canvas shifted RIGHT by 8%
    # This moves the purple glowing orb away from the left vertical Japanese title
    final_canvas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    
    # Center horizontally + shift right by 8%
    shift_x = int(width * 0.08)
    paste_x = (width - width) // 2 + shift_x
    paste_y = 0
    
    final_canvas.paste(char_extracted, (paste_x, paste_y), char_extracted)
    final_canvas.save(dst_path, "PNG")
    print(f"Successfully shifted Magician RIGHT by 8% to clear text overlap: {dst_path}")

if __name__ == "__main__":
    adjust_magician()
