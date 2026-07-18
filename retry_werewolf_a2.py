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

RAW_A2_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72-a2"
OUT_A2_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72-a2"

t = {
    "id": "werewolf", "jp": "人狼 A", "en": "Werewolf A", "color": "red",
    "bg": "a blood red background showing a giant red crescent moon and dead branch silhouettes in blood red tones",
    "char": "a single werewolf"
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
    print("Retrying single failed werewolf Ver A2 task...")
    
    pose_desc = (
        "posing in a stylized thin posture, featuring a fully covered normal flesh and skin body (no exposed bones, no skeletons) but with hyper-slender, elongated, and slightly twisted artistic limbs. "
        "The character is positioned slightly lower in the frame to ensure the top 15% is clear of head/face/details for title overlay text."
    )
    
    prompt = (
        f"A stylized hand-drawn high-fashion graphic art of {t['char']}, set against {t['bg']}. {pose_desc} "
        f"Exaggerated G-pen ink strokes with extreme thick-to-thin pressure variations. "
        f"No uniform thick black lines; instead, it features dynamic colored outlines that change color based on the local color of the body part. "
        f"The character is colored in highly muted, desaturated tones, while the background details use the same color tones to keep the card color identification clear. "
        f"Full screen bleed, no borders. Absolutely not anime, not realistic. Aspect ratio 9:16."
    )
    
    payload = {
        "model": "flux-2/pro-text-to-image",
        "input": {
            "prompt": prompt,
            "aspect_ratio": "9:16",
            "resolution": "1K"
        }
    }
    
    task_id = None
    for try_idx in range(3):
        try:
            response = requests.post(f"{API_URL}/jobs/createTask", json=payload, headers=HEADERS, timeout=30)
            res_json = response.json()
            if response.status_code == 200 and res_json.get("code") == 200:
                task_id = res_json.get("data", {}).get("taskId")
                print(f"Submitted werewolf_ver_a2: Task ID = {task_id}")
                break
            else:
                print(f"Error (try {try_idx+1}/3): {res_json}")
                time.sleep(3)
        except Exception as e:
            print(f"Exception (try {try_idx+1}/3): {e}")
            time.sleep(3)
            
    if not task_id:
        print("Failed to submit task!")
        return
        
    print("\nPolling werewolf task status...")
    start_time = time.time()
    timeout = 300
    
    while True:
        if time.time() - start_time > timeout:
            print("Session timeout reached!")
            break
            
        time.sleep(15)
        
        try:
            r = requests.get(f"{API_URL}/jobs/recordInfo?taskId={task_id}", headers=HEADERS, timeout=15)
            res_json = r.json()
            if r.status_code == 200 and res_json.get("code") == 200:
                data = res_json.get("data", {})
                status = data.get("state")
                print(f"Task werewolf_ver_a2 retry status: {status}")
                
                if status == "success":
                    url = None
                    result_json_str = data.get("resultJson")
                    if result_json_str:
                        try:
                            result_data = json.loads(result_json_str)
                            urls = result_data.get("resultUrls", [])
                            if urls:
                                url = urls[0]
                        except Exception:
                            pass
                    if not url:
                        url = find_image_url(res_json)
                        
                    if url:
                        raw_path = os.path.join(RAW_A2_DIR, "werewolf_ver_a.png")
                        out_path = os.path.join(OUT_A2_DIR, "werewolf_ver_a.png")
                        print("  Downloading werewolf...")
                        img_data = requests.get(url, timeout=30).content
                        with open(raw_path, 'wb') as f:
                            f.write(img_data)
                        
                        # Overlay labels
                        overlay_card_labels(raw_path, out_path, t["jp"], t["en"])
                        print("  Successfully finished werewolf.")
                        
                        # Copy to main folder
                        shutil.copy2(raw_path, "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72/werewolf_ver_a.png")
                        shutil.copy2(out_path, "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72/werewolf_ver_a.png")
                        break
                    else:
                        print("  No URL found.")
                        break
                elif status in ["fail", "error"]:
                    print("  Task failed.")
                    break
        except Exception as e:
            print(f"  Polling error: {e}")

if __name__ == "__main__":
    main()
