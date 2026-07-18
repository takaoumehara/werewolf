import os
import math
from PIL import Image, ImageFilter

src_dir = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72-a"
dst_dir = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-transparent-72"

def process_character(role_id, zoom_factor=1.0, shift_pct=0.0):
    src_path = os.path.join(src_dir, f"{role_id}_ver_a.png")
    dst_path = os.path.join(dst_dir, f"{role_id}_ver_a.png")
    
    if not os.path.exists(src_path):
        print(f"Error: Original {role_id} image not found: {src_path}")
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
    
    # 3. Apply Zoom if needed
    if zoom_factor != 1.0:
        new_w = int(width * zoom_factor)
        new_h = int(height * zoom_factor)
        char_processed = char_extracted.resize((new_w, new_h), Image.Resampling.LANCZOS)
    else:
        new_w, new_h = width, height
        char_processed = char_extracted
        
    # 4. Paste onto transparent canvas with Shift
    final_canvas = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    
    # Center horizontally
    paste_x = (width - new_w) // 2
    
    # Shift vertically
    shift_y = int(height * shift_pct)
    # Adjust paste_y offset based on scaling
    scale_offset = (height - new_h) // 2
    paste_y = scale_offset + shift_y
    
    final_canvas.paste(char_processed, (paste_x, paste_y), char_processed)
    final_canvas.save(dst_path, "PNG")
    print(f"Successfully processed {role_id}: Zoom = {zoom_factor*100:.1f}%, Shift = {shift_pct*100:.1f}%")

def main():
    print("Adjusting alignments for Werewolf Child and Android transparent PNGs...")
    
    # Werewolf Child: shift down by 12% to avoid title overlap
    process_character("werewolf_child", zoom_factor=1.0, shift_pct=0.12)
    
    # Android: zoom in by 13% and shift down by only 3% to move it higher up (fill excess top margin)
    process_character("android", zoom_factor=1.13, shift_pct=0.03)
    
    print("--- Alignment Adjustments Completed ---")

if __name__ == "__main__":
    main()
