import os
import json
from PIL import Image

src_dir = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72-a"

roles = [
    "dictator", "knights", "double", "counselor", "necromancer",
    "trapper", "citizen", "prophet", "bodyguard", "twins",
    "magician", "hunter", "tough_guy", "spy", "betrayal_twin",
    "werewolf", "traitor", "betrayer", "werewolf_child", "android",
    "lone_wolf", "god", "lovers", "mysterious_fox"
]

def analyze_role(role_id):
    file_name = f"{role_id}_ver_a.png"
    file_path = os.path.join(src_dir, file_name)
    if not os.path.exists(file_path):
        return None
        
    img = Image.open(file_path)
    if img.mode != 'RGB':
        img = img.convert('RGB')
        
    width, height = img.size
    pixels = img.load()
    
    # 1. Detect background color (take sample at top-center)
    bg_samples = []
    for x in range(int(width/2)-5, int(width/2)+5):
        for y in range(10, 20):
            bg_samples.append(pixels[x, y])
            
    # Calculate median background color
    bg_r = sorted([c[0] for c in bg_samples])[len(bg_samples)//2]
    bg_g = sorted([c[1] for c in bg_samples])[len(bg_samples)//2]
    bg_b = sorted([c[2] for c in bg_samples])[len(bg_samples)//2]
    bg_color = (bg_r, bg_g, bg_b)
    
    def color_dist(c1, c2):
        return ((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2 + (c1[2]-c2[2])**2)**0.5
        
    # Check overlap in left-top L-shape & right-top
    # We sample every 4th pixel for speed
    
    # JP Vertical: Left 20% width, Upper 65% height
    jp_w = int(width * 0.20)
    jp_h = int(height * 0.65)
    jp_count = 0
    jp_non_bg = 0
    for x in range(0, jp_w, 4):
        for y in range(0, jp_h, 4):
            jp_count += 1
            if color_dist(pixels[x, y], bg_color) > 25:
                jp_non_bg += 1
                
    # EN RT (JP Mode): Right 70%-95% width, Upper 15% height
    en_rt_x1 = int(width * 0.70)
    en_rt_x2 = int(width * 0.95)
    en_rt_h = int(height * 0.15)
    en_rt_count = 0
    en_rt_non_bg = 0
    for x in range(en_rt_x1, en_rt_x2, 4):
        for y in range(0, en_rt_h, 4):
            en_rt_count += 1
            if color_dist(pixels[x, y], bg_color) > 25:
                en_rt_non_bg += 1
                
    # EN Left-Top (EN Mode): Left 0%-75% width, Upper 15% height
    en_v_x2 = int(width * 0.75)
    en_v_h = int(height * 0.15)
    en_v_count = 0
    en_v_non_bg = 0
    for x in range(0, en_v_x2, 4):
        for y in range(0, en_v_h, 4):
            en_v_count += 1
            if color_dist(pixels[x, y], bg_color) > 25:
                en_v_non_bg += 1
                
    return {
        "jp_overlap": jp_non_bg / jp_count if jp_count > 0 else 0,
        "en_rt_overlap": en_rt_non_bg / en_rt_count if en_rt_count > 0 else 0,
        "en_vertical_overlap": en_v_non_bg / en_v_count if en_v_count > 0 else 0,
        "bg_color": bg_color
    }

def main():
    print(f"{'Role':<20} | {'JP Overlap %':<15} | {'EN RT Overlap %':<15} | {'EN Left-Top Overlap %':<20}")
    print("-" * 80)
    
    results = {}
    for r in roles:
        res = analyze_role(r)
        if res:
            results[r] = res
            print(f"{r:<20} | {res['jp_overlap']*100:13.1f}% | {res['en_rt_overlap']*100:13.1f}% | {res['en_vertical_overlap']*100:18.1f}%")
            
    with open("overlap_results.json", "w") as f:
        json.dump(results, f, indent=4)

if __name__ == "__main__":
    main()
