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

failed_roles = [
    {
        "id": "prophet", "jp": "予言者 A", "en": "Prophet A", "color": "purple",
        "bg": "a purple background showing a large glowing crystal ball silhouette and mystic stars in purple tones",
        "char": "a single prophet looking at a crystal ball"
    },
    {
        "id": "spy", "jp": "スパイ A", "en": "Spy A", "color": "black",
        "bg": "a pure black background featuring dark gray shadows and industrial factory steel girders in the background",
        "char": "a single spy on a steel girder"
    },
    {
        "id": "werewolf", "jp": "人狼 A", "en": "Werewolf A", "color": "red",
        "bg": "a blood red background showing a giant red crescent moon and dead branch silhouettes in blood red tones",
        "char": "a single werewolf"
    },
    {
        "id": "mysterious_fox", "jp": "妖狐 A", "en": "Mysterious fox A", "color": "dusty pink",
        "bg": "a dusty pink background filled with a low small crescent moon and iron fence, but with dusty pink clouds added to enhance the atmosphere",
        "char": "a white fox character in dark dress"
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
    print("Retrying 4 failed Ver A2 tasks (prophet, spy, werewolf, fox)...")
    
    task_map = {}
    for idx, t in enumerate(failed_roles):
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
        
        print(f"Submitting retry [{idx+1}/4] Ver A2 task for {t['en']}...")
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
                    print(f"  Submitted {t['id']}_ver_a2: Task ID = {task_id}")
                    break
                else:
                    print(f"  Error (try {try_idx+1}/3): {res_json}")
                    time.sleep(3)
            except Exception as e:
                print(f"  Exception (try {try_idx+1}/3): {e}")
                time.sleep(3)
                
        if task_id:
            task_map[t["id"]] = {
                "taskId": task_id,
                "jp": t["jp"],
                "en": t["en"]
            }
        time.sleep(2.5)
        
    print(f"\nAll retry tasks submitted. Polling for {len(task_map)} tasks...")
    
    completed = {}
    failed = []
    start_time = time.time()
    timeout = 600
    
    while len(completed) + len(failed) < len(task_map):
        if time.time() - start_time > timeout:
            print("Session timeout reached!")
            break
            
        time.sleep(15)
        
        for r_id, info in task_map.items():
            if r_id in completed or r_id in failed:
                continue
                
            task_id = info["taskId"]
            try:
                r = requests.get(f"{API_URL}/jobs/recordInfo?taskId={task_id}", headers=HEADERS, timeout=15)
                res_json = r.json()
                if r.status_code == 200 and res_json.get("code") == 200:
                    data = res_json.get("data", {})
                    status = data.get("state")
                    print(f"Task {r_id}_ver_a2 retry status: {status}")
                    
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
                            raw_path = os.path.join(RAW_A2_DIR, f"{r_id}_ver_a.png")
                            out_path = os.path.join(OUT_A2_DIR, f"{r_id}_ver_a.png")
                            print(f"  Downloading {r_id}_ver_a2...")
                            img_data = requests.get(url, timeout=30).content
                            with open(raw_path, 'wb') as f:
                                f.write(img_data)
                            
                            # Overlay labels
                            overlay_card_labels(raw_path, out_path, info["jp"], info["en"])
                            completed[r_id] = out_path
                            print(f"  Successfully finished redrawing {r_id}_ver_a2.")
                        else:
                            print(f"  No URL for {r_id}_ver_a2")
                            failed.append(r_id)
                    elif status in ["fail", "error"]:
                        print(f"  Failed on KIE.AI for {r_id}_ver_a2")
                        failed.append(r_id)
            except Exception as e:
                print(f"  Polling error for {r_id}_ver_a2: {e}")
                
        print(f"Progress: {len(completed)} completed, {len(failed)} failed out of {len(task_map)}")

    print("\n--- A2 Retries Finished ---")
    print(f"Successfully Redrawn: {len(completed)}")

if __name__ == "__main__":
    main()
