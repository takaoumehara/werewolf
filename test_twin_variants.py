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

RAW_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/test-twin-raw"
OUT_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/test-twin-variants"

os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)

# 3 Different versions of "Betrayal twin" (裏切りの共有者)
# Focuses on skewed proportions, slightly distorted/uncanny anatomical features, colored outlines (not pure black), and distinct background colors.
twin_variants = [
    {
        "id": "betrayal_twin_ver_a", 
        "jp": "裏切りの共有者 A", 
        "en": "Betrayal twin Ver.A", 
        "prompt": "A stylized hand-drawn high-fashion graphic art of two twin gothic lolita sisters standing back-to-back, posing with twisted skeletal limbs and slightly uncanny, elongated fingers. Purposefully skewed proportions and asymmetrical shoulder heights. Muted hot pink, black, and white flat color palette. Harmonized dark-colored outlines like deep maroon and dark charcoal instead of pure black outlines. Raw G-pen ink strokes with pen-hatching shadows on faces. Background is a vibrant solid hot pink diagonally split with black. No framing, full screen bleed. Absolutely not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "betrayal_twin_ver_b", 
        "jp": "裏切りの共有者 B", 
        "en": "Betrayal twin Ver.B", 
        "prompt": "A stylized hand-drawn high-fashion graphic art of two twin gothic lolita sisters in an asymmetrical mirror pose, one sister staring with a tilted, slightly uncanny head angle, holding a key. Purposefully distorted anatomical proportions. Muted acid green, navy blue, and white flat color palette. Harmonized dark-tinted outlines like deep indigo and dark olive instead of pure black. Strong raw ink shading. Background is a solid acid yellow-green with diagonal graphic shapes. Full bleed. Not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "betrayal_twin_ver_c", 
        "jp": "裏切りの共有者 C", 
        "en": "Betrayal twin Ver.C", 
        "prompt": "A stylized hand-drawn high-fashion graphic art of two twin gothic lolita sisters overlapping each other, one sister looking down with a sharp tilted gaze, showing slightly distorted proportions and uneven shoulders. Muted deep crimson, violet, and pale gray flat color palette. Harmonized dark-colored outlines like dark plum and charcoal. Raw expressive pen lines and heavy dry-brush hatching. Background is a solid deep crimson. No border, full bleed. Not anime, not realistic. Aspect ratio 9:16."
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
    print(f"Submitting Betrayal twin variant task for {role['en']}...")
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
    for role in twin_variants:
        role_id, task_id = submit_task(role)
        if task_id:
            task_map[role_id] = task_id
        time.sleep(2.0)
        
    print("\nAll tasks submitted. Starting polling loop...")
    
    completed = {}
    failed = []
    start_time = time.time()
    timeout = 300
    
    while len(completed) + len(failed) < len(task_map):
        if time.time() - start_time > timeout:
            print("Timeout!")
            break
            
        time.sleep(10)
        
        for role_id, task_id in task_map.items():
            if role_id in completed or role_id in failed:
                continue
                
            status, url = check_task_status(task_id)
            print(f"Variant {role_id} status: {status}")
            
            if status == "success":
                if url:
                    role_info = next(r for r in twin_variants if r["id"] == role_id)
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
                
        print(f"Progress: {len(completed)} completed, {len(failed)} failed out of {len(task_map)}")

    print("\n--- Test Session Finished ---")
    print(f"Succeeded: {len(completed)}")
    print(f"Failed: {len(failed)}")

if __name__ == "__main__":
    main()
