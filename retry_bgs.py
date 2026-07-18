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

retry_definitions = [
    {"id": "necromancer", "color": "hot pink", "motif": "mystical magic runes, circles, and pink magical spell wisps"},
    {"id": "bodyguard", "color": "dark gray", "motif": "a heavy iron fortress gate, metal grids, and shield patterns"},
    {"id": "spy", "color": "black", "motif": "dark industrial factory steel girders, pipes, and metal mesh grids"},
    {"id": "betrayal_twin", "color": "deep blue", "motif": "beautiful roses, creeping thorns, and dark floral patterns"},
    {"id": "werewolf", "color": "blood red", "motif": "a giant full crescent moon, dead tree branches, and wild clouds"},
    {"id": "lone_wolf", "color": "dark red", "motif": "a solitary cliff edge, a large distant full moon, and misty valleys"}
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
    print("Retrying 6 failed background-only tasks...")
    
    tasks_to_submit = []
    for r in retry_definitions:
        prompt = (
            f"A highly detailed, intricate hand-drawn G-pen style engraving background. "
            f"Colored entirely in a monochromatic color palette of {r['color']} (with only very subtle shifts in value: slightly darker {r['color']} shadows and slightly lighter {r['color']} highlights). "
            f"It features {r['motif']} with delicate linework, cross-hatching, and textures. "
            f"Flat lighting, clean graphic art style. Absolutely no human figures, no people, no characters, clear background scene ONLY. "
            f"Full screen bleed, no borders, no cards. Aspect ratio 9:16."
        )
        tasks_to_submit.append({
            "id": r["id"],
            "prompt": prompt
        })

    task_map = {}
    for idx, t in enumerate(tasks_to_submit):
        print(f"Submitting retry [{idx+1}/{len(tasks_to_submit)}] Background task for {t['id']}...")
        payload = {
            "model": "flux-2/pro-text-to-image",
            "input": {
                "prompt": t["prompt"],
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
                    print(f"  Submitted {t['id']}_bg: Task ID = {task_id}")
                    break
                else:
                    print(f"  Error (try {try_idx+1}/3): {res_json}")
                    time.sleep(3)
            except Exception as e:
                print(f"  Exception (try {try_idx+1}/3): {e}")
                time.sleep(3)
                
        if task_id:
            task_map[t["id"]] = task_id
        time.sleep(2.5)
        
    print(f"\nPolling for {len(task_map)} retry tasks...")
    
    completed = {}
    failed = []
    start_time = time.time()
    timeout = 600
    
    while len(completed) + len(failed) < len(task_map):
        if time.time() - start_time > timeout:
            print("Session timeout reached!")
            break
            
        time.sleep(15)
        
        for r_id, task_id in task_map.items():
            if r_id in completed or r_id in failed:
                continue
                
            try:
                r = requests.get(f"{API_URL}/jobs/recordInfo?taskId={task_id}", headers=HEADERS, timeout=15)
                res_json = r.json()
                if r.status_code == 200 and res_json.get("code") == 200:
                    data = res_json.get("data", {})
                    status = data.get("state")
                    print(f"Background {r_id}_bg retry status: {status}")
                    
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
                            out_path = os.path.join(BG_DIR, f"{r_id}_bg.png")
                            print(f"  Downloading {r_id}_bg...")
                            img_data = requests.get(url, timeout=30).content
                            with open(out_path, 'wb') as f:
                                f.write(img_data)
                            completed[r_id] = out_path
                            print(f"  Successfully finished retry {r_id}_bg.")
                        else:
                            print(f"  No URL for {r_id}_bg")
                            failed.append(r_id)
                    elif status in ["fail", "error"]:
                        print(f"  Failed on KIE.AI for {r_id}_bg")
                        failed.append(r_id)
            except Exception as e:
                print(f"  Polling error for {r_id}_bg: {e}")
                
        print(f"Progress: {len(completed)} completed, {len(failed)} failed out of {len(task_map)}")

    print("\n--- Background Retries Finished ---")
    print(f"Successfully Generated: {len(completed)}")

if __name__ == "__main__":
    main()
