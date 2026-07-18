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

# 7 roles needing character/props to be lowered to resolve title text collision
target_roles = [
    {
        "id": "traitor",
        "jp": "内通者 A",
        "en": "Traitor A",
        "color": "orange",
        "pose": "posing in a stylish thin posture, with head and fedora hat positioned lower in the frame, leaving the upper 20% of the image as completely empty solid-colored space. Rising cigarette smoke must also remain low and not reach the top edge",
        "desc": "an untrustworthy single gentleman in a trench coat and fedora hat, smoking a cigarette, holding a pocket notebook"
    },
    {
        "id": "dictator",
        "jp": "独裁者 A",
        "en": "Dictator A",
        "color": "dark blue",
        "pose": "posing in a stylized thin posture, with head and the golden scepter held lower in the frame, leaving the upper 20% of the image as completely empty solid-colored space",
        "desc": "a sophisticated single dictator gentleman in a military uniform standing on a balcony, holding a golden scepter"
    },
    {
        "id": "android",
        "jp": "アンドロイド A",
        "en": "Android A",
        "color": "gray",
        "pose": "posing in a stylized thin posture, with head positioned lower in the frame, leaving the upper 20% of the image as completely empty solid-colored space",
        "desc": "a single mechanical android character with glowing lines"
    },
    {
        "id": "lovers",
        "jp": "恋人 A",
        "en": "Lovers A",
        "color": "rose red",
        "pose": "posing passionately, with both characters positioned lower in the frame, leaving the upper 25% of the image as completely empty solid-colored space",
        "desc": "two stylish young man and woman leaning against each other passionately"
    },
    {
        "id": "betrayal_twin",
        "jp": "裏切りの共有者 A",
        "en": "Betrayal Twin A",
        "color": "deep blue",
        "pose": "standing side-by-side, with both characters positioned lower in the frame, leaving the upper 25% of the image as completely empty solid-colored space",
        "desc": "two devious twin characters standing side-by-side, whispering to each other"
    },
    {
        "id": "twins",
        "jp": "共有者 A",
        "en": "Twins A",
        "color": "gold",
        "pose": "standing side-by-side, with both characters positioned lower in the frame, leaving the upper 25% of the image as completely empty solid-colored space",
        "desc": "two friendly twin characters standing side-by-side"
    },
    {
        "id": "knights",
        "jp": "騎士団 A",
        "en": "Knights A",
        "color": "sky blue",
        "pose": "standing side-by-side, with all three knights positioned lower in the frame, leaving the upper 25% of the image as completely empty solid-colored space",
        "desc": "three valiant knights standing side-by-side"
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
    print("Starting generation for lowered-pose character assets (resolving title text collisions)...")
    
    tasks_to_submit = []
    for r in target_roles:
        # Standardize the hyper-slender stylization but force lower positioning
        pose_desc = (
            f"{r['pose']}, featuring a fully covered normal flesh and skin body (no exposed bones, no skeletons) but with hyper-slender, elongated, and slightly twisted artistic limbs."
        )
        
        prompt = (
            f"A stylized hand-drawn high-fashion graphic art of {r['desc']}, {pose_desc}. "
            f"Exaggerated G-pen ink strokes with extreme thick-to-thin pressure variations. "
            f"No uniform thick black lines; instead, it features dynamic colored outlines that change color based on the local color of the body part. "
            f"The character is colored in highly muted, desaturated tones, while the background is a solid vibrant {r['color']} "
            f"(creating a stark contrast between character and backdrop). "
            f"Full screen bleed, no borders. Absolutely not anime, not realistic. Aspect ratio 9:16."
        )
        
        tasks_to_submit.append({
            "id": r["id"],
            "jp": r["jp"],
            "en": r["en"],
            "prompt": prompt
        })

    # 1. Submit tasks
    task_map = {}
    for idx, t in enumerate(tasks_to_submit):
        print(f"Submitting [{idx+1}/{len(tasks_to_submit)}] Ver A task for {t['en']} (Lowered Pose)...")
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
                    print(f"  Submitted {t['id']}_ver_a: Task ID = {task_id}")
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
        
    print(f"\nAll tasks submitted. Running polling loop for {len(task_map)} tasks...")
    
    completed = {}
    failed = []
    start_time = time.time()
    timeout = 900
    
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
                    print(f"Task {r_id}_ver_a status: {status}")
                    
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
                            raw_path = os.path.join(RAW_A_DIR, f"{r_id}_ver_a.png")
                            out_path = os.path.join(OUT_A_DIR, f"{r_id}_ver_a.png")
                            print(f"  Downloading {r_id}_ver_a...")
                            img_data = requests.get(url, timeout=30).content
                            with open(raw_path, 'wb') as f:
                                f.write(img_data)
                            
                            # Overlay card labels
                            overlay_card_labels(raw_path, out_path, info["jp"], info["en"])
                            
                            # Copy to main folder
                            shutil.copy2(raw_path, f"/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72/{r_id}_ver_a.png")
                            shutil.copy2(out_path, f"/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72/{r_id}_ver_a.png")
                            
                            completed[r_id] = out_path
                            print(f"  Successfully finished redrawing {r_id}_ver_a with title clearance.")
                        else:
                            print(f"  No URL for {r_id}_ver_a")
                            failed.append(r_id)
                    elif status in ["fail", "error"]:
                        print(f"  Failed on KIE.AI for {r_id}_ver_a")
                        failed.append(r_id)
            except Exception as e:
                print(f"  Polling error for {r_id}_ver_a: {e}")
                
        print(f"Progress: {len(completed)} completed, {len(failed)} failed out of {len(task_map)}")

    print("\n--- Lowered Pose Redraw Finished ---")
    print(f"Successfully Redrawn: {len(completed)}")

if __name__ == "__main__":
    main()
