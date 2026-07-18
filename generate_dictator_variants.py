import os
from PIL import Image, ImageDraw, ImageFont, ImageOps

BASE_IMAGE = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72-a/dictator_ver_a.png"
ORIGINAL_CITIZEN = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/original-art/jinro00002.png"
OUT_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム"

# Font paths
JAP_BOLD = "/System/Library/Fonts/ヒラギノ角ゴシック W8.ttc"
JAP_EXTRA_BOLD = "/System/Library/Fonts/Supplemental/Arial Black.ttf" # fallback or heavy
JAP_HEAVY = "/System/Library/Fonts/ヒラギノ角ゴシック W9.ttc"
JAP_MINCHO = "/System/Library/Fonts/ヒラギノ明朝 ProN.ttc"
ENG_SERIF = "/System/Library/Fonts/Supplemental/Baskerville.ttc"
ENG_SERIF_TIMES = "/System/Library/Fonts/Supplemental/Times New Roman Bold.ttf"
ENG_SANS = "/System/Library/Fonts/HelveticaNeue.ttc"

def extract_citizen_icon():
    """Extracts the white citizen logo from jinro00002.png and returns a white transparent logo."""
    if not os.path.exists(ORIGINAL_CITIZEN):
        return None
    try:
        orig = Image.open(ORIGINAL_CITIZEN)
        # Crop the exact emblem area
        emblem = orig.crop((40, 855, 140, 955)) # 100x100
        
        # We want to extract the white outlines.
        # Background is black, outlines are white. We convert it to a mask (L mode).
        mask = emblem.convert("L")
        # Enhance contrast to make outlines pure white and background pure black
        mask = mask.point(lambda p: 255 if p > 150 else 0)
        
        # Create a solid white image of the same size and apply the mask
        white_img = Image.new("RGBA", (100, 100), (255, 255, 255, 255))
        white_img.putalpha(mask)
        return white_img
    except Exception as e:
        print(f"Error extracting icon: {e}")
        return None

def draw_text_with_outline(draw, position, text, font, text_color, outline_color, outline_width):
    x, y = position
    # Draw outline in all directions
    for dx in range(-outline_width, outline_width + 1):
        for dy in range(-outline_width, outline_width + 1):
            if dx*dx + dy*dy <= outline_width*outline_width:
                draw.text((x + dx, y + dy), text, font=font, fill=outline_color)
    # Draw main text
    draw.text((x, y), text, font=font, fill=text_color)

def draw_vertical_text(draw, start_pos, text, font, text_color, outline_color, outline_width, char_spacing):
    x, y = start_pos
    y_current = y
    char_positions = []
    
    for char in text:
        # Draw character
        draw_text_with_outline(draw, (x, y_current), char, font, text_color, outline_color, outline_width)
        # Record center Y position of each character for ruby placement
        char_positions.append((x, y_current, font.getbbox(char)))
        y_current += font.getbbox(char)[3] - font.getbbox(char)[1] + char_spacing
        
    return char_positions

def draw_vertical_ruby(draw, char_positions, ruby_texts, font, text_color, outline_color, outline_width, x_offset):
    """Draws vertical ruby text aligned to the right of each character."""
    # ruby_texts is a list of strings corresponding to each character, e.g., ["どく", "さい", "しゃ"]
    for idx, (cx, cy, bbox) in enumerate(char_positions):
        if idx >= len(ruby_texts):
            break
        ruby = ruby_texts[idx]
        if not ruby:
            continue
            
        c_height = bbox[3] - bbox[1]
        c_width = bbox[2] - bbox[0]
        
        # Calculate vertical size of the ruby text
        ruby_char_heights = []
        for rc in ruby:
            r_bbox = font.getbbox(rc)
            ruby_char_heights.append(r_bbox[3] - r_bbox[1])
            
        total_ruby_height = sum(ruby_char_heights) + (len(ruby) - 1) * 2
        
        # Align ruby vertically to the center of the character
        ry_start = cy + (c_height - total_ruby_height) / 2
        rx = cx + c_width + x_offset
        
        ry_current = ry_start
        for r_idx, rc in enumerate(ruby):
            draw_text_with_outline(draw, (rx, ry_current), rc, font, text_color, outline_color, outline_width)
            ry_current += ruby_char_heights[r_idx] + 2

def create_variant_1():
    """Variant 1: Original-Art Classic (Hiragino W8, Baskerville, Solid rounded band)"""
    img = Image.open(BASE_IMAGE).convert("RGBA")
    draw = ImageDraw.Draw(img)
    
    # 1. Main Kanji Vertical
    font_main = ImageFont.truetype(JAP_BOLD, 85)
    char_spacing = 15
    char_positions = draw_vertical_text(draw, (50, 60), "独裁者", font_main, (255, 255, 255), (0, 0, 0), 8, char_spacing)
    
    # 2. Ruby (furigana)
    font_ruby = ImageFont.truetype(JAP_BOLD, 22)
    draw_vertical_ruby(draw, char_positions, ["どく", "さい", "しゃ"], font_ruby, (255, 255, 255), (0, 0, 0), 3, 5)
    
    # 3. English Name (Baskerville)
    font_eng = ImageFont.truetype(ENG_SERIF, 40)
    # Right-aligned check: width of "Dictator"
    eng_text = "Dictator"
    eng_bbox = font_eng.getbbox(eng_text)
    eng_w = eng_bbox[2] - eng_bbox[0]
    draw_text_with_outline(draw, (720 - eng_w - 50, 60), eng_text, font_eng, (255, 255, 255), (0, 0, 0), 3)
    
    # 4. Bottom Description Band
    # Band size: width 620, height 170, bottom margin 40 (Y=1070)
    band_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    band_draw = ImageDraw.Draw(band_layer)
    # Draw dark translucent rounded rectangle
    band_draw.rounded_rectangle([50, 1070, 670, 1240], radius=15, fill=(0, 0, 0, 200))
    img = Image.alpha_composite(img, band_layer)
    draw = ImageDraw.Draw(img)
    
    # 5. Citizen Icon crop and paste
    icon = extract_citizen_icon()
    if icon:
        icon_resized = icon.resize((80, 80))
        img.paste(icon_resized, (75, 1115), icon_resized)
        
    # 6. Description Text (2 lines)
    desc_font = ImageFont.truetype(JAP_BOLD, 22)
    desc_lines = [
        "投票時に自分の正体を明かすことで、",
        "その日の投票を自分一人で決定できる。"
    ]
    dy_current = 1115
    for dl in desc_lines:
        draw.text((175, dy_current), dl, font=desc_font, fill=(255, 255, 255))
        dy_current += 34
        
    img.save(os.path.join(OUT_DIR, "dictator_variant_1.png"))
    print("Saved Variant 1")

def create_variant_2():
    """Variant 2: Modern Bold Gothic (Hiragino W9, Helvetica, Thin double outline)"""
    img = Image.open(BASE_IMAGE).convert("RGBA")
    draw = ImageDraw.Draw(img)
    
    # 1. Main Kanji Vertical (Extra heavy W9)
    font_main = ImageFont.truetype(JAP_HEAVY, 90)
    char_spacing = 12
    char_positions = draw_vertical_text(draw, (55, 60), "独裁者", font_main, (255, 255, 255), (20, 20, 20), 10, char_spacing)
    
    # 2. Ruby
    font_ruby = ImageFont.truetype(JAP_BOLD, 24)
    draw_vertical_ruby(draw, char_positions, ["どく", "さい", "しゃ"], font_ruby, (255, 255, 255), (20, 20, 20), 4, 8)
    
    # 3. English Name (Helvetica)
    font_eng = ImageFont.truetype(ENG_SANS, 42)
    eng_text = "Dictator"
    eng_bbox = font_eng.getbbox(eng_text)
    eng_w = eng_bbox[2] - eng_bbox[0]
    draw_text_with_outline(draw, (720 - eng_w - 50, 60), eng_text, font_eng, (255, 255, 255), (20, 20, 20), 4)
    
    # 4. Bottom Band (More transparent, modern square sharp design)
    band_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    band_draw = ImageDraw.Draw(band_layer)
    band_draw.rectangle([50, 1070, 670, 1240], fill=(10, 10, 15, 170), outline=(255, 255, 255, 50), width=2)
    img = Image.alpha_composite(img, band_layer)
    draw = ImageDraw.Draw(img)
    
    # 5. Icon
    icon = extract_citizen_icon()
    if icon:
        icon_resized = icon.resize((80, 80))
        img.paste(icon_resized, (75, 1115), icon_resized)
        
    # 6. Description Text (Modern white)
    desc_font = ImageFont.truetype(JAP_BOLD, 22)
    desc_lines = [
        "投票時に自分の正体を明かすことで、",
        "その日の投票を自分一人で決定できる。"
    ]
    dy_current = 1115
    for dl in desc_lines:
        draw.text((175, dy_current), dl, font=desc_font, fill=(255, 255, 255))
        dy_current += 34
        
    img.save(os.path.join(OUT_DIR, "dictator_variant_2.png"))
    print("Saved Variant 2")

def create_variant_3():
    """Variant 3: Elegant Mincho Style (Hiragino Mincho, Times Bold Italic, Dark Plum Outline)"""
    img = Image.open(BASE_IMAGE).convert("RGBA")
    draw = ImageDraw.Draw(img)
    
    # 1. Main Kanji Vertical (Elegant Mincho)
    font_main = ImageFont.truetype(JAP_MINCHO, 85)
    char_spacing = 18
    # Dark Plum outline (50, 10, 30)
    char_positions = draw_vertical_text(draw, (50, 60), "独裁者", font_main, (255, 255, 255), (50, 10, 30), 6, char_spacing)
    
    # 2. Ruby (Mincho)
    font_ruby = ImageFont.truetype(JAP_MINCHO, 20)
    draw_vertical_ruby(draw, char_positions, ["どく", "さい", "しゃ"], font_ruby, (255, 255, 255), (50, 10, 30), 2, 4)
    
    # 3. English Name (Times Roman Italic)
    font_eng = ImageFont.truetype(ENG_SERIF_TIMES, 40)
    eng_text = "Dictator"
    eng_bbox = font_eng.getbbox(eng_text)
    eng_w = eng_bbox[2] - eng_bbox[0]
    draw_text_with_outline(draw, (720 - eng_w - 50, 60), eng_text, font_eng, (255, 255, 255), (50, 10, 30), 3)
    
    # 4. Bottom Band (Deep plum tint, radius 25)
    band_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    band_draw = ImageDraw.Draw(band_layer)
    band_draw.rounded_rectangle([50, 1070, 670, 1240], radius=25, fill=(30, 5, 15, 210))
    img = Image.alpha_composite(img, band_layer)
    draw = ImageDraw.Draw(img)
    
    # 5. Icon
    icon = extract_citizen_icon()
    if icon:
        icon_resized = icon.resize((80, 80))
        img.paste(icon_resized, (75, 1115), icon_resized)
        
    # 6. Description Text (Mincho white)
    desc_font = ImageFont.truetype(JAP_MINCHO, 22)
    desc_lines = [
        "投票時に自分の正体を明かすことで、",
        "その日の投票を自分一人で決定できる。"
    ]
    dy_current = 1115
    for dl in desc_lines:
        draw.text((175, dy_current), dl, font=desc_font, fill=(255, 255, 255))
        dy_current += 34
        
    img.save(os.path.join(OUT_DIR, "dictator_variant_3.png"))
    print("Saved Variant 3")

def main():
    create_variant_1()
    create_variant_2()
    create_variant_3()

if __name__ == "__main__":
    main()
