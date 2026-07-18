import os
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

knights_task = {
    "id": "knights",
    "jp": "騎士団 A",
    "en": "Knights A",
    "taskId": "cc5290da684f67c3a9fc9663bfc470ef",
    "shift_pct": 0.05 # Adjusted to 5% (much less margin) to restore character presence
}

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
    img = Image.open(raw_img_path)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    width, height = img.size
    
    # Detect background color
    bg_color = img.getpixel((15, 15))
    
    # Create new padded canvas
    new_img = Image.new('RGB', (width, height), bg_color)
    
    # Paste original image shifted down by 5%
    shift_y = int(height * shift_pct)
    new_img.paste(img, (0, shift_y))
    new_img.save(raw_img_path)
    print(f"  Knights shifted down by {shift_pct*100:.1f}% ({shift_y} pixels). Background: RGB{bg_color}")

def main():
    print(f"Adjusting Knights vertical shift to 5%...")
    try:
        r = requests.get(f"{API_URL}/jobs/recordInfo?taskId={knights_task['taskId']}", headers=HEADERS, timeout=15)
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
                raw_path = os.path.join(RAW_A_DIR, "knights_ver_a.png")
                out_path = os.path.join(OUT_A_DIR, "knights_ver_a.png")
                
                print("  Downloading original knights asset...")
                img_data = requests.get(url, timeout=30).content
                with open(raw_path, 'wb') as f:
                    f.write(img_data)
                
                # Apply 5% shift
                process_shift(raw_path, knights_task["shift_pct"])
                
                # Re-synthesize labels
                overlay_card_labels(raw_path, out_path, knights_task["jp"], knights_task["en"])
                
                # Copy to main directories
                shutil.copy2(raw_path, "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72/knights_ver_a.png")
                shutil.copy2(out_path, "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72/knights_ver_a.png")
                
                # Copy to brain artifacts
                dst_dir = "/Users/takao/.gemini/antigravity-ide/brain/c3268d57-16e6-4226-8f97-26c14e19d2a4"
                shutil.copy2(out_path, os.path.join(dst_dir, "test_72_knights_ver_a.png"))
                
                print("  Successfully adjusted Knights to 5% shift.")
            else:
                print("  Error: Could not retrieve URL.")
        else:
            print("  Error: API request failed.")
    except Exception as e:
        print(f"  Exception: {e}")

if __name__ == "__main__":
    main()
