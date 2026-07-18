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
os.makedirs(BG_DIR, exist_ok=True)

# Define matching colors and motifs for background-only generation
bg_definitions = [
    {"id": "dictator", "color": "vibrant navy blue", "motif": "gothic palace hallway arches, stone balcony balustrades, and a starry night sky"},
    {"id": "knights", "color": "sky blue", "motif": "medieval castle ramparts, fortress stone walls, and cross heraldry patterns"},
    {"id": "double", "color": "cyan", "motif": "mysterious abstract double-mirror frames and shattered glass patterns"},
    {"id": "counselor", "color": "emerald green", "motif": "classical counseling room interior bookshelves and elegant window frames"},
    {"id": "necromancer", "color": "hot pink", "motif": "mystical magic runes, circles, and pink magical spell wisps"},
    {"id": "trapper", "color": "lime green", "motif": "dense forest vines, foliage, undergrowth, and simple rope trap details"},
    {"id": "citizen", "color": "teal", "motif": "a peaceful simple village with cozy houses, wooden fences, and pathway outlines"},
    {"id": "prophet", "color": "purple", "motif": "a large glowing crystal ball shape on a wooden pedestal with floating starry dust"},
    {"id": "bodyguard", "color": "dark gray", "motif": "a heavy iron fortress gate, metal grids, and shield patterns"},
    {"id": "twins", "color": "gold", "motif": "radiant beams of light, keyholes, and two matching golden key outlines"},
    {"id": "magician", "color": "violet", "motif": "floating playing cards, top hats, and circular magic stage spotlights"},
    {"id": "hunter", "color": "deep green", "motif": "deep forest trees, crosshairs, and silhouette branches"},
    {"id": "tough_guy", "color": "olive green", "motif": "rugged brick wall textures, wooden crates, and metal industrial patterns"},
    {"id": "spy", "color": "black", "motif": "dark industrial factory steel girders, pipes, and metal mesh grids"},
    {"id": "betrayal_twin", "color": "deep blue", "motif": "beautiful roses, creeping thorns, and dark floral patterns"},
    {"id": "werewolf", "color": "blood red", "motif": "a giant full crescent moon, dead tree branches, and wild clouds"},
    {"id": "traitor", "color": "orange", "motif": "a cobblestone street, brick alleyway walls, and a single gas street lamp"},
    {"id": "betrayer", "color": "dark purple", "motif": "billowing dark flames, rising smoke patterns, and ominous shadows"},
    {"id": "werewolf_child", "color": "magenta", "motif": "small glowing fireflies, cute but creepy little eyes in the bushes, and stardust"},
    {"id": "android", "color": "gray", "motif": "futuristic digital circuit board lines, grid patterns, and technical nodes"},
    {"id": "lone_wolf", "color": "dark red", "motif": "a solitary cliff edge, a large distant full moon, and misty valleys"},
    {"id": "god", "color": "bright yellow", "motif": "radiant sun rays breaking through soft heavenly clouds"},
    {"id": "lovers", "color": "rose red", "motif": "softly floating flower petals and delicate matching heart patterns"},
    {"id": "mysterious_fox", "color": "dusty pink", "motif": "a low crescent moon, ruined iron gates, and wisps of mist"}
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
    print("Starting generation of background-only assets (A2 layer style)...")
    
    tasks_to_submit = []
    for r in bg_definitions:
        # Strict monochromatic detailed background prompt
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

    # Submit tasks
    task_map = {}
    for idx, t in enumerate(tasks_to_submit):
        print(f"Submitting [{idx+1}/{len(tasks_to_submit)}] Background task for {t['id']}...")
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
        
    print(f"\nAll tasks submitted. Running polling loop for {len(task_map)} tasks...")
    
    completed = {}
    failed = []
    start_time = time.time()
    timeout = 1800 # 30 minutes
    
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
                    print(f"Background {r_id}_bg status: {status}")
                    
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
                            print(f"  Successfully finished {r_id}_bg.")
                        else:
                            print(f"  No URL for {r_id}_bg")
                            failed.append(r_id)
                    elif status in ["fail", "error"]:
                        print(f"  Failed on KIE.AI for {r_id}_bg")
                        failed.append(r_id)
            except Exception as e:
                print(f"  Polling error for {r_id}_bg: {e}")
                
        print(f"Progress: {len(completed)} completed, {len(failed)} failed out of {len(task_map)}")

    # Dump status
    status_file = os.path.join(BG_DIR, "generation_status.json")
    with open(status_file, 'w') as f:
        json.dump({"completed": list(completed.keys()), "failed": failed}, f)
        
    print("\n--- Background Generation Finished ---")
    print(f"Successfully Generated: {len(completed)}")

if __name__ == "__main__":
    main()
