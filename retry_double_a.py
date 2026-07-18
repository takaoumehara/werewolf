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

t = {
    "id": "double",
    "jp": "影武者 A",
    "en": "Double A",
    "prompt": (
        "A stylized hand-drawn high-fashion graphic art of a mysterious young man in a long coat, creating multiple glowing dark visual illusions of himself in the background, posing back-to-back, featuring a fully covered normal flesh and skin body but with hyper-slender, elongated, and slightly twisted artistic limbs and fingers, showcasing a stylized thin posture. "
        "Absolutely no exposed bones, no skeletal body parts, no skeleton imagery. "
        "Exaggerated G-pen ink strokes with extreme thick-to-thin pressure variations. "
        "No uniform thick black lines; instead, it features dynamic colored outlines that change color based on the local color of the body part (e.g. dark violet outline on violet areas, dark beige outline on skin). "
        "The character is colored in highly muted, desaturated tones (charcoal, dark olive, pale gray, beige), while the background is a solid vibrant deep violet. "
        "Full screen bleed, no borders. Absolutely not anime, not realistic. Aspect ratio 9:16."
    )
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

def main():
    print(f"Submitting retry task for {t['en']}...")
    payload = {
        "model": "flux-2/pro-text-to-image",
        "input": {
            "prompt": t["prompt"],
            "aspect_ratio": "9:16",
            "resolution": "1K"
        }
    }
    
    try:
        response = requests.post(f"{API_URL}/jobs/createTask", json=payload, headers=HEADERS, timeout=30)
        res_json = response.json()
        if response.status_code == 200 and res_json.get("code") == 200:
            task_id = res_json.get("data", {}).get("taskId")
            print(f"Submitted task: ID = {task_id}")
        else:
            print(f"Error submitting: {res_json}")
            return
    except Exception as e:
        print(f"HTTP Exception: {e}")
        return

    print("Polling task status...")
    start_time = time.time()
    timeout = 300
    
    while True:
        if time.time() - start_time > timeout:
            print("Timeout!")
            break
            
        time.sleep(10)
        
        try:
            r = requests.get(f"{API_URL}/jobs/recordInfo?taskId={task_id}", headers=HEADERS, timeout=15)
            r_json = r.json()
            if r.status_code == 200 and r_json.get("code") == 200:
                data = r_json.get("data", {})
                status = data.get("state")
                print(f"Status: {status}")
                
                if status == "success":
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
                        print("Downloading...")
                        img_data = requests.get(url, timeout=30).content
                        with open(raw_path, 'wb') as f:
                            f.write(img_data)
                        
                        overlay_card_labels(raw_path, out_path, t["jp"], t["en"])
                        
                        # Copy to main folders
                        shutil.copy2(raw_path, f"/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72/{t['id']}_ver_a.png")
                        shutil.copy2(out_path, f"/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72/{t['id']}_ver_a.png")
                        
                        print("Successfully completed!")
                        break
                    else:
                        print("No URL found.")
                        break
                elif status in ["fail", "error"]:
                    print(f"Failed on KIE: {r_json}")
                    break
        except Exception as e:
            print(f"Polling error: {e}")

if __name__ == "__main__":
    main()
