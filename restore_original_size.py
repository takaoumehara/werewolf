import os
import sys
import time
import requests
import json
import shutil
from generate_cards import overlay_card_labels

API_KEY = "f42bc196113ea943377f64713e5aebf2"
API_URL = "https://api.kie.ai/api/v1"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

RAW_A_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72-a"
OUT_A_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72-a"

# Task IDs for the original high-impact layouts (prior to extreme lower margins)
restore_tasks = [
    {
        "id": "counselor",
        "jp": "カウンセラー A",
        "en": "Counselor A",
        "taskId": "87d07f187744c7ee501390ea70c373a4"
    },
    {
        "id": "necromancer",
        "jp": "霊媒師 A",
        "en": "Necromancer A",
        "taskId": "d07cbe2f02c9327325032409786aa53c"
    },
    {
        "id": "lovers",
        "jp": "恋人 A",
        "en": "Lovers A",
        "taskId": "d749039170358bffb2183c4e0782686a"
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

def main():
    print("Starting restoration of Counselor, Necromancer, and Lovers to high-impact sizes...")
    
    for t in restore_tasks:
        print(f"Restoring {t['en']} (Task ID: {t['taskId']})...")
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
                    print(f"  Downloading original image...")
                    img_data = requests.get(url, timeout=30).content
                    with open(raw_path, 'wb') as f:
                        f.write(img_data)
                    
                    # Synthesize card labels
                    overlay_card_labels(raw_path, out_path, t["jp"], t["en"])
                    
                    # Copy to main folder
                    shutil.copy2(raw_path, f"/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72/{t['id']}_ver_a.png")
                    shutil.copy2(out_path, f"/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72/{t['id']}_ver_a.png")
                    print(f"  Successfully restored {t['en']}.")
                else:
                    print(f"  Error: Could not retrieve URL for {t['en']}.")
            else:
                print(f"  Error: API request failed for {t['en']}.")
        except Exception as e:
            print(f"  Exception restoring {t['en']}: {e}")

if __name__ == "__main__":
    main()
