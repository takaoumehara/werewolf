import os
import sys
import time
import requests
import json

API_KEY = "f42bc196113ea943377f64713e5aebf2"
API_URL = "https://api.kie.ai/api/v1"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

BG_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/backgrounds-72"

t = {
    "id": "werewolf",
    "color": "dark maroon and dark blood red", # Slightly modified to be extremely clear and deep
    "motif": "spooky night sky with a crescent moon behind swirling dark clouds and silhouette of dead tree branches"
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
    print("Retrying werewolf background with a darker, deep wine blood red tone...")
    
    prompt = (
        f"A highly detailed, intricate hand-drawn G-pen style engraving background. "
        f"Colored entirely in a monochromatic color palette of {t['color']} (with only very subtle shifts in value: near-black maroon shadows and dark blood red highlights). "
        f"It features {t['motif']} with delicate linework, cross-hatching, and textures. "
        f"Flat lighting, clean graphic art style. Absolutely no human figures, no people, no characters, clear background scene ONLY. "
        f"Full screen bleed, no borders, no cards. Aspect ratio 9:16."
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
                print(f"Submitted werewolf_bg: Task ID = {task_id}")
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
        
    print("\nPolling werewolf background task status...")
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
                print(f"Task werewolf_bg retry status: {status}")
                
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
                        out_path = os.path.join(BG_DIR, "werewolf_bg.png")
                        print("  Downloading werewolf background...")
                        img_data = requests.get(url, timeout=30).content
                        with open(out_path, 'wb') as f:
                            f.write(img_data)
                        print("  Successfully finished werewolf background.")
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
