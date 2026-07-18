import os
import sys
import time
import requests
import json
import shutil
from PIL import Image
from generate_cards import overlay_card_labels

API_KEY = "f42bc196113ea943377f64713e5aebf2"
API_URL = "https://api.kie.ai/api/v1"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

RAW_A_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72-a"
OUT_A_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72-a"

# Roles to restore to original high-quality assets and apply a precise Pillow shift-down
roles_to_shift = [
    # 1. 10-15% Shift-down (User complained about too much AI-space, want original details shifted)
    {
        "id": "dictator",
        "jp": "独裁者 A",
        "en": "Dictator A",
        "taskId": "31c08a430f96733ac0f5f656a02db3da", # Original with perfect face
        "shift_pct": 0.12 # 12% vertical shift (10-15% range)
    },
    {
        "id": "twins",
        "jp": "共有者 A",
        "en": "Twins A",
        "taskId": "411aa048125d03757ba9cbf084402f19", # Original big layout
        "shift_pct": 0.12
    },
    {
        "id": "traitor",
        "jp": "内通者 A",
        "en": "Traitor A",
        "taskId": "078f82a45c9ae5031fce1b1082bbe759", # Original big layout
        "shift_pct": 0.12
    },
    {
        "id": "lovers",
        "jp": "恋人 A",
        "en": "Lovers A",
        "taskId": "d749039170358bffb2183c4e0782686a", # Original big layout
        "shift_pct": 0.12
    },
    {
        "id": "knights",
        "jp": "騎士団 A",
        "en": "Knights A",
        "taskId": "cc5290da684f67c3a9fc9663bfc470ef", # Original big layout
        "shift_pct": 0.12
    },
    {
        "id": "betrayal_twin",
        "jp": "裏切りの共有者 A",
        "en": "Betrayal Twin A",
        "taskId": "400129c5ab478d958519eb434c626756", # Original big layout
        "shift_pct": 0.12
    },
    {
        "id": "android",
        "jp": "アンドロイド A",
        "en": "Android A",
        "taskId": "26f6e4828129971f5d480b7e859b742a", # Original big layout
        "shift_pct": 0.12
    },
    # 2. Add 10% more shift-down (User asked to add 10% more vertical space to counselor)
    {
        "id": "counselor",
        "jp": "カウンセラー A",
        "en": "Counselor A",
        "taskId": "87d07f187744c7ee501390ea70c373a4", # Original big layout
        "shift_pct": 0.11 # Shift down by 11% to create optimal top-clearance
    }
]

def find_image_url(data):
    if isinstance(data, str):
        if data.startswith("http://") or data.startswith("https://"):
            if any(ext in data.lower() for ext in [".png", ".jpg", ".jpeg", ".webp"]):
                return data
    elif isinstance(data, dict):
        for val in data.values():
            res = find_image_url(val)
            if res:
                return res
    elif isinstance(data, list):
        for val in data:
            res = find_image_url(val)
            if res:
                return res
    return None

def process_shift(raw_img_path, shift_pct):
    """
    Load raw image, detect its background color at (10, 10),
    shift the image down by `shift_pct` vertically, and fill the top with the background color.
    """
    img = Image.open(raw_img_path)
    if img.mode != 'RGB':
        img = img.convert('RGB')
        
    width, height = img.size
    
    # 1. Sample background color at top-left corner (15, 15)
    bg_color = img.getpixel((15, 15))
    
    # 2. Create a new canvas filled with the background color
    new_img = Image.new('RGB', (width, height), bg_color)
    
    # 3. Paste the original image shifted down
    shift_y = int(height * shift_pct)
    new_img.paste(img, (0, shift_y))
    
    # Save back to raw path (overwriting the shifted result)
    new_img.save(raw_img_path)
    print(f"  Shifted down by {shift_pct*100:.1f}% ({shift_y} pixels), filled top with RGB{bg_color}.")

def main():
    print("Starting precise image shift-down and background padding to ensure 10-15% top clearance...")
    
    for t in roles_to_shift:
        print(f"\nProcessing {t['en']} (Task ID: {t['taskId']})...")
        try:
            r = requests.get(f"{API_URL}/jobs/recordInfo?taskId={t['taskId']}", headers=HEADERS, timeout=15)
            r_json = r.json()
            if r.status_code == 200 and r_json.get("code") == 200:
                data = r_json.get("data", {})
                url = find_image_url(r_json)
                if not url:
                    result_json_str = data.get("resultJson")
                    if result_json_str:
                        try:
                            result_data = json.loads(result_json_str)
                            urls = result_data.get("resultUrls", [])
                            if urls:
                                url = urls[0]
                        except Exception:
                            pass
                            
                if url:
                    raw_path = os.path.join(RAW_A_DIR, f"{t['id']}_ver_a.png")
                    out_path = os.path.join(OUT_A_DIR, f"{t['id']}_ver_a.png")
                    
                    print(f"  Downloading original high-resolution graphic...")
                    img_data = requests.get(url, timeout=30).content
                    with open(raw_path, 'wb') as f:
                        f.write(img_data)
                    
                    # Apply Pillow Shift-down
                    process_shift(raw_path, t["shift_pct"])
                    
                    # Synthesize card labels on top of the shifted image
                    overlay_card_labels(raw_path, out_path, t["jp"], t["en"])
                    
                    # Copy to main directories for consistency
                    shutil.copy2(raw_path, f"/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72/{t['id']}_ver_a.png")
                    shutil.copy2(out_path, f"/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72/{t['id']}_ver_a.png")
                    print(f"  Successfully finished shifting and labeling {t['en']}.")
                else:
                    print(f"  Error: Could not retrieve URL for {t['en']}.")
            else:
                print(f"  Error: API request failed for {t['en']}.")
        except Exception as e:
            print(f"  Exception processing {t['en']}: {e}")

if __name__ == "__main__":
    main()
