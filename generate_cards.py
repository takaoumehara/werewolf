import os
import sys
from PIL import Image, ImageDraw, ImageFont

def render_vertical_text(draw, text, x, y, font, fill_color, stroke_color, stroke_width, line_spacing=8):
    current_y = y
    for char in text:
        # Get bounding box of the character
        bbox = draw.textbbox((0, 0), char, font=font)
        char_w = bbox[2] - bbox[0]
        char_h = bbox[3] - bbox[1]
        
        # Center character horizontally slightly if needed, but simple vertical stack is standard
        # Draw stroke/outline
        for dx in range(-stroke_width, stroke_width + 1):
            for dy in range(-stroke_width, stroke_width + 1):
                if dx*dx + dy*dy <= stroke_width*stroke_width:
                    draw.text((x + dx, current_y + dy), char, font=font, fill=stroke_color)
        
        # Draw fill
        draw.text((x, current_y), char, font=font, fill=fill_color)
        
        # Move down for next character
        # Using height + line_spacing. If height is abnormally small (e.g. for punctuation), default to font size
        step = max(char_h, font.size - 10)
        current_y += step + line_spacing

def overlay_card_labels(img_path, output_path, jp_name, en_name):
    print(f"Processing: {jp_name} ({en_name}) -> {output_path}")
    try:
        img = Image.open(img_path)
        if img.mode != 'RGBA':
            img = img.convert('RGBA')
            
        draw = ImageDraw.Draw(img)
        
        # Attempt to load fonts with system fallbacks
        try:
            font_jp = ImageFont.truetype("Hiragino Sans GB.ttc", 60)
        except Exception:
            try:
                font_jp = ImageFont.truetype("/System/Library/Fonts/PingFang.ttc", 60)
            except Exception:
                print("Warning: Could not find Hiragino or PingFang, falling back to default font.")
                font_jp = ImageFont.load_default()
                
        try:
            font_en = ImageFont.truetype("Trebuchet MS Bold.ttf", 36)
        except Exception:
            try:
                font_en = ImageFont.truetype("HelveticaNeue.ttc", 36)
            except Exception:
                font_en = ImageFont.load_default()
                
        # 1. Overlay Japanese Vertical Name on the upper left
        # Standard margin: X=50, Y=80
        render_vertical_text(
            draw=draw, 
            text=jp_name, 
            x=50, 
            y=80, 
            font=font_jp, 
            fill_color=(255, 255, 255, 255), 
            stroke_color=(0, 0, 0, 255), 
            stroke_width=5,
            line_spacing=10
        )
        
        # 2. Overlay English Horizontal Name on the upper right
        # Dynamic right alignment
        if hasattr(font_en, "getbbox"):
            en_bbox = draw.textbbox((0, 0), en_name, font=font_en)
            en_width = en_bbox[2] - en_bbox[0]
        else:
            en_width = draw.textlength(en_name, font=font_en)
            
        en_x = img.width - en_width - 50
        en_y = 80
        
        # Draw stroke for English
        for dx in range(-3, 4):
            for dy in range(-3, 4):
                if dx*dx + dy*dy <= 9:
                    draw.text((en_x + dx, en_y + dy), en_name, font=font_en, fill=(0, 0, 0, 255))
        # Draw English fill
        draw.text((en_x, en_y), en_name, font=font_en, fill=(255, 255, 255, 255))
        
        # Optional: Add a subtle black vignette/border to frame the card nicely
        border_width = 0
        # Draw a dark border
        # draw.rectangle([0, 0, img.width, img.height], outline=(0, 0, 0, 255), width=border_width)
        
        # Save as PNG
        img.save(output_path, "PNG")
        print("Success")
    except Exception as e:
        print(f"Error processing {jp_name}: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 5:
        print("Usage: python generate_cards.py <input_img> <output_img> <jp_name> <en_name>")
        sys.exit(1)
        
    input_img = sys.argv[1]
    output_img = sys.argv[2]
    jp_name = sys.argv[3]
    en_name = sys.argv[4]
    
    overlay_card_labels(input_img, output_img, jp_name, en_name)
