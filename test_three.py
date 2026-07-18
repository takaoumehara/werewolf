import os
import sys
import time
import requests
import json
from generate_cards import overlay_card_labels

API_KEY = "f42bc196113ea943377f64713e5aebf2"
API_URL = "https://api.kie.ai/api/v1"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

RAW_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/test-raw-illustrations"
OUT_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/test-generated-cards"

os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)

test_roles = [
    {
        "id": "werewolf", 
        "jp": "人狼", 
        "en": "Werewolf", 
        "prompt": "An edgy, raw hand-crafted linocut and risograph print illustration of a ferocious, muscular werewolf wearing a torn leather jacket, crouching on top of broken concrete ruins under a giant blood red moon. Gritty ink textures, prominent paper grain, and vintage ink-bleed edges. Rough dry-brush ink strokes with heavy pressure variations, bold hand-carved black outline with dry-brush taper. High-contrast flat color layers with deliberate slight color misregistrations. Raw, dramatic, and abstract character design with intense sharp eyes. Absolutely no clean digital vectors, no smooth airbrushing, no 3D rendering, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "citizen", 
        "jp": "市民", 
        "en": "Citizen", 
        "prompt": "An edgy, raw hand-crafted linocut and risograph print illustration of a young rustic farmer holding a vintage glowing oil lantern, standing alert beside a young girl in a defensive pose in a dark village. Gritty ink textures, prominent paper grain, and vintage ink-bleed edges. Rough dry-brush ink strokes with heavy pressure variations, bold hand-carved black outline with dry-brush taper. High-contrast flat color layers with deliberate slight color misregistrations. Raw, dramatic, and abstract character design with intense sharp eyes. Background features silhouettes of old wooden house roofs under a light blue moon. Absolutely no clean digital vectors, no smooth airbrushing, no 3D rendering, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "prophet", 
        "jp": "予言者", 
        "en": "Prophet", 
        "prompt": "An edgy, raw hand-crafted linocut and risograph print illustration of a wise old sage with a long white beard, sitting on a high wooden chair, staring forward intensely while holding a glowing green sphere. Gritty ink textures, prominent paper grain, and vintage ink-bleed edges. Rough dry-brush ink strokes with heavy pressure variations, bold hand-carved black outline with dry-brush taper. High-contrast flat color layers with deliberate slight color misregistrations. Raw, dramatic, and abstract character design with intense sharp eyes. Background features subtle ancient library bookshelves in the shadows. Absolutely no clean digital vectors, no smooth airbrushing, no 3D rendering, not anime, not realistic. Aspect ratio 9:16."
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

def submit_task(role):
    print(f"Submitting test task for {role['jp']} ({role['en']})...")
    payload = {
        "model": "flux-2/pro-text-to-image",
        "input": {
            "prompt": role["prompt"],
            "aspect_ratio": "9:16",
            "resolution": "1K"
        }
    }
    try:
        response = requests.post(f"{API_URL}/jobs/createTask", json=payload, headers=HEADERS, timeout=30)
        res_json = response.json()
        if response.status_code == 200 and res_json.get("code") == 200:
            task_id = res_json.get("data", {}).get("taskId")
            print(f"Submitted {role['en']}: Task ID = {task_id}")
            return role["id"], task_id
        else:
            print(f"Error submitting {role['en']}: {res_json}")
            return role["id"], None
    except Exception as e:
        print(f"HTTP Exception submitting {role['en']}: {e}")
        return role["id"], None

def check_task_status(task_id):
    try:
        response = requests.get(f"{API_URL}/jobs/recordInfo?taskId={task_id}", headers=HEADERS, timeout=15)
        res_json = response.json()
        if response.status_code == 200 and res_json.get("code") == 200:
            data = res_json.get("data", {})
            status = data.get("state")
            result_json_str = data.get("resultJson")
            url = None
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
            return status, url
        return "error", None
    except Exception as e:
        return "error_exception", None

def download_image(url, save_path):
    try:
        r = requests.get(url, timeout=30)
        if r.status_code == 200:
            with open(save_path, 'wb') as f:
                f.write(r.content)
            return True
    except Exception as e:
        print(f"Download error: {e}")
    return False

def main():
    task_map = {}
    for role in test_roles:
        role_id, task_id = submit_task(role)
        if task_id:
            task_map[role_id] = task_id
        time.sleep(2.0)
        
    print("\nAll test tasks submitted. Starting polling loop...")
    
    completed = {}
    failed = []
    start_time = time.time()
    timeout = 300
    
    while len(completed) + len(failed) < len(task_map):
        if time.time() - start_time > timeout:
            print("Timeout reached!")
            break
            
        time.sleep(10)
        
        for role_id, task_id in task_map.items():
            if role_id in completed or role_id in failed:
                continue
                
            status, url = check_task_status(task_id)
            print(f"Role {role_id} status: {status}")
            
            if status == "success":
                if url:
                    role_info = next(r for r in test_roles if r["id"] == role_id)
                    save_path = os.path.join(RAW_DIR, f"{role_id}.png")
                    print(f"Task {role_id} succeeded. Downloading...")
                    if download_image(url, save_path):
                        completed[role_id] = save_path
                        print(f"Saved raw image to {save_path}")
                        
                        # Generate labeled card
                        out_path = os.path.join(OUT_DIR, f"{role_id}.png")
                        overlay_card_labels(save_path, out_path, role_info["jp"], role_info["en"])
                    else:
                        print(f"Download failed for {role_id}")
                        failed.append(role_id)
                else:
                    print(f"No URL found for {role_id}")
                    failed.append(role_id)
            elif status in ["fail", "error"]:
                print(f"Task {role_id} failed on KIE.AI side.")
                failed.append(role_id)
                
        print(f"Test progress: {len(completed)} completed, {len(failed)} failed out of {len(task_map)}")

    print("\n--- Test Session Finished ---")
    print(f"Succeeded: {len(completed)}")
    print(f"Failed: {len(failed)}")

if __name__ == "__main__":
    main()
