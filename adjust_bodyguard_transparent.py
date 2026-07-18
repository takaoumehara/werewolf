import os
import math
from PIL import Image, ImageFilter

src_path = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72-a/bodyguard_ver_a.png"
dst_path = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-transparent-72/bodyguard_ver_a.png"

def adjust_bodyguard():
    if not os.path.exists(src_path):
        print(f"Error: Original bodyguard image not found: {src_path}")
        return
        
    img = Image.open(src_path)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    width, height = img.size
    
    # 1. Detect background color at top-left corner
    bg_color = img.getpixel((15, 15))
    bg_r, bg_g, bg_b = bg_color
    
    # 2. Extract original character to a temporary RGBA image
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
    
    # 3. Zoom character slightly (e.g. 8% upscale) as requested by user ("少し画像を拡大してもいいです その分だけ")
    zoom_factor = 1.08
    new_w = int(width * zoom_factor)
    new_h = int(height * zoom_factor)
    char_zoomed = char_extracted.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # 4. Paste the zoomed character shifted down by 15% onto a clean transparent canvas
    final_canvas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    
    # Center horizontally, shift down by 15% vertically
    paste_x = (width - new_w) // 2
    shift_y = int(height * 0.15) # 15% shift down to clear the title area completely
    paste_y = paste_x + shift_y # Adjust vertical offset taking zoom scale into account
    
    final_canvas.paste(char_zoomed, (paste_x, paste_y), char_zoomed)
    final_canvas.save(dst_path, "PNG")
    print(f"Successfully zoomed and shifted Bodyguard by 15% to clear English title: {dst_path}")

if __name__ == "__main__":
    adjust_bodyguard()
