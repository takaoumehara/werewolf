import os
import math
import random
from PIL import Image, ImageDraw, ImageFilter

src_dir = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72-a"
dst_dir = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72-a2"

os.makedirs(dst_dir, exist_ok=True)

roles = [
    "dictator", "knights", "double", "counselor", "necromancer",
    "trapper", "citizen", "prophet", "bodyguard", "twins",
    "magician", "hunter", "tough_guy", "spy", "betrayal_twin",
    "werewolf", "traitor", "betrayer", "werewolf_child", "android",
    "lone_wolf", "god", "lovers", "mysterious_fox"
]

def make_radial_gradient(width, height, center_color, edge_color):
    """Generate a smooth radial gradient with vignette effect."""
    base = Image.new('RGB', (width, height), edge_color)
    draw = ImageDraw.Draw(base)
    
    # Draw radial rings
    max_dim = max(width, height)
    steps = 150
    cx, cy = width // 2, height // 2
    
    for i in range(steps):
        r_pct = 1.0 - (i / steps)
        # Interpolate color
        curr_r = int(center_color[0] * r_pct + edge_color[0] * (1.0 - r_pct))
        curr_g = int(center_color[1] * r_pct + edge_color[1] * (1.0 - r_pct))
        curr_b = int(center_color[2] * r_pct + edge_color[2] * (1.0 - r_pct))
        
        radius = int(max_dim * 0.8 * r_pct)
        if radius > 0:
            draw.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(curr_r, curr_g, curr_b))
            
    # Soft blur to make it perfectly smooth
    return base.filter(ImageFilter.GaussianBlur(30))

def draw_background_pattern(bg_img, bg_color, theme):
    """Draw theme-specific matching-tone patterns onto the background."""
    width, height = bg_img.size
    draw = ImageDraw.Draw(bg_img, 'RGBA')
    
    # Calculate a matching outline/pattern color (slightly brighter or darker version of bg_color)
    # Ensure it's very subtle (alpha around 20-40 out of 255)
    sum_bg = sum(bg_color)
    if sum_bg > 380: # Brighter background -> draw darker pattern
        pat_color = (max(0, bg_color[0]-40), max(0, bg_color[1]-40), max(0, bg_color[2]-40), 30)
    else: # Darker background -> draw brighter pattern
        pat_color = (min(255, bg_color[0]+40), min(255, bg_color[1]+40), min(255, bg_color[2]+40), 25)
        
    if theme == "stripes":
        # Dictator style: gothic vertical stripes
        stripe_w = 40
        for x in range(0, width, stripe_w * 2):
            draw.rectangle([x, 0, x + stripe_w, height], fill=pat_color)
            
    elif theme == "grid":
        # Android style: digital techno grid
        grid_w = 80
        for x in range(0, width, grid_w):
            draw.line([(x, 0), (x, height)], fill=pat_color, width=2)
        for y in range(0, height, grid_w):
            draw.line([(0, y), (width, y)], fill=pat_color, width=2)
            
    elif theme == "magic_circle":
        # Necromancer / Prophet style: mystic magic circle and runes
        cx, cy = width // 2, height // 3
        # Draw concentric rings
        draw.ellipse([cx - 200, cy - 200, cx + 200, cy + 200], outline=pat_color, width=3)
        draw.ellipse([cx - 250, cy - 250, cx + 250, cy + 250], outline=pat_color, width=2)
        # Inner pentagram or lines
        for angle in range(0, 360, 60):
            rad = math.radians(angle)
            tx = cx + int(250 * math.cos(rad))
            ty = cy + int(250 * math.sin(rad))
            draw.line([(cx, cy), (tx, ty)], fill=pat_color, width=2)
            
    elif theme == "moon_forest":
        # Werewolf / Lone Wolf: big faint moon glowing and forest branch outlines
        cx, cy = width // 2, height // 4
        # Draw a big soft glowing moon shape
        moon_color = (pat_color[0], pat_color[1], pat_color[2], 50)
        draw.ellipse([cx - 150, cy - 150, cx + 150, cy + 150], fill=moon_color)
        
        # Dead tree silhouettes at the bottom
        draw.rectangle([0, height-150, width, height], fill=pat_color)
        for x in range(10, width, 60):
            th = random.randint(100, 250)
            draw.line([(x, height), (x + random.randint(-20, 20), height - th)], fill=pat_color, width=6)
            
    elif theme == "roses":
        # Betrayal Twin / Lovers: elegant roses/thorn wire curves
        for i in range(8):
            # Draw random wavy bezier curves representing vines
            p1 = (random.randint(0, width), 0)
            p2 = (random.randint(0, width), height//2)
            p3 = (random.randint(0, width), height)
            draw.line([p1, p2, p3], fill=pat_color, width=3)
            
    elif theme == "stars":
        # General mystic / God style: soft dust particles and tiny stars
        for _ in range(120):
            sx = random.randint(0, width)
            sy = random.randint(0, height)
            size = random.randint(2, 6)
            draw.ellipse([sx - size, sy - size, sx + size, sy + size], fill=pat_color)
            
    elif theme == "sunbeams":
        # Twins style: rays of light from the center
        cx, cy = width // 2, height // 3
        for angle in range(0, 360, 15):
            rad = math.radians(angle)
            tx = cx + int(1200 * math.cos(rad))
            ty = cy + int(1200 * math.sin(rad))
            draw.line([(cx, cy), (tx, ty)], fill=pat_color, width=4)

def extract_character_mask(img, bg_color):
    """
    Generate a high-quality anti-aliased character mask by calculating
    color distance from the solid background color.
    """
    width, height = img.size
    img_rgba = img.convert('RGBA')
    img_data = img_rgba.load()
    
    mask = Image.new('L', (width, height), 0)
    mask_data = mask.load()
    
    bg_r, bg_g, bg_b = bg_color
    
    for y in range(height):
        for x in range(width):
            r, g, b, a = img_data[x, y]
            # Euclidean distance in RGB space
            dist = math.sqrt((r - bg_r)**2 + (g - bg_g)**2 + (b - bg_b)**2)
            
            # Smooth thresholding (anti-aliased borders)
            if dist < 22:
                alpha = 0
            elif dist > 45:
                alpha = 255
            else:
                # Linear interpolation between 22 and 45
                alpha = int((dist - 22) / (45 - 22) * 255)
                
            mask_data[x, y] = alpha
            
    # Apply a tiny blur to the mask to make the G-pen ink outlines perfectly smooth
    return mask.filter(ImageFilter.GaussianBlur(1.0))

def composite_role(role_id):
    file_name = f"{role_id}_ver_a.png"
    src_path = os.path.join(src_dir, file_name)
    dst_path = os.path.join(dst_dir, file_name)
    
    if not os.path.exists(src_path):
        print(f"File not found: {src_path}")
        return
        
    img = Image.open(src_path)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    width, height = img.size
    
    # 1. Detect background color at top-left corner
    bg_color = img.getpixel((15, 15))
    
    # 2. Design the matching-tone gradient colors
    # Center color: 20-30% brighter
    center_color = (
        min(255, int(bg_color[0] * 1.35 + 20)),
        min(255, int(bg_color[1] * 1.35 + 20)),
        min(255, int(bg_color[2] * 1.35 + 20))
    )
    # Edge color: 30-40% darker
    edge_color = (
        max(0, int(bg_color[0] * 0.55)),
        max(0, int(bg_color[1] * 0.55)),
        max(0, int(bg_color[2] * 0.55))
    )
    
    # 3. Create radial gradient background
    bg_img = make_radial_gradient(width, height, center_color, edge_color)
    
    # 4. Apply specific atmospheric pattern theme
    theme = "stars" # default
    if role_id == "dictator":
        theme = "stripes"
    elif role_id == "knights":
        theme = "sunbeams"
    elif role_id in ["necromancer", "prophet", "magician"]:
        theme = "magic_circle"
    elif role_id in ["werewolf", "lone_wolf", "mysterious_fox"]:
        theme = "moon_forest"
    elif role_id in ["lovers", "betrayal_twin"]:
        theme = "roses"
    elif role_id in ["android"]:
        theme = "grid"
    elif role_id in ["twins", "god"]:
        theme = "sunbeams"
        
    draw_background_pattern(bg_img, bg_color, theme)
    
    # 5. Extract original character outline mask
    char_mask = extract_character_mask(img, bg_color)
    
    # 6. Composite character onto the new illustrated background
    bg_img.paste(img, (0, 0), char_mask)
    
    # Save the output (without any rasterized labels)
    bg_img.save(dst_path)
    print(f"Successfully processed and composited {role_id} into {dst_path}")

def main():
    print("Starting background composition for the A2 series...")
    for r in roles:
        composite_role(r)
    print("--- Background Composition Finished ---")

if __name__ == "__main__":
    main()
