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

# 4 Roles that need significant upper margin space (character/moon moved down)
target_roles = [
    {
        "id": "counselor",
        "jp": "カウンセラー A",
        "en": "Counselor A",
        "color": "emerald green",
        "desc": "a sophisticated single gentleman with wavy hair wearing a high-collared coat, showing a mysterious face, positioned lower in the frame, leaving the upper 25% of the frame completely empty"
    },
    {
        "id": "necromancer",
        "jp": "霊媒師 A",
        "en": "Necromancer A",
        "color": "hot pink",
        "desc": "a mystical single female shaman in a starry gown, raising her hands to summon glowing magic wisps of light, positioned lower in the frame, leaving the upper 25% of the frame completely empty"
    },
    {
        "id": "lovers",
        "jp": "恋人 A",
        "en": "Lovers A",
        "color": "rose red",
        "desc": "a stylish young man and woman leaning against each other passionately, positioned lower in the frame, leaving the upper 25% of the frame completely empty"
    },
    {
        "id": "mysterious_fox",
        "jp": "妖狐 A",
        "en": "Mysterious fox A",
        "color": "dusty pink",
        "desc": "an elegant single white fox character in a dark dress, standing near a ruined iron fence, with a small crescent moon positioned low in the middle-right background, leaving the upper 25% of the frame completely empty"
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
    print("Starting generation for the 4 roles requiring upper margins (counselor, necromancer, lovers, fox)...")
    
    tasks_to_submit = []
    for r in target_roles:
        # Posing instruction: forcing character/prop positioning low and upper 25% completely empty
        pose_desc = (
            "posing in a stylized thin posture, featuring a fully covered normal flesh and skin body but with hyper-slender, elongated, and slightly twisted artistic limbs and fingers. "
            "Absolutely no exposed bones, no skeletal body parts, no skeleton imagery. "
            "Character's head must be positioned well below the top edge, leaving the upper 25% of the image as a blank solid-colored space for overlay text."
        )
        
        prompt = (
            f"A stylized hand-drawn high-fashion graphic art of {r['desc']}, {pose_desc}. "
            f"Exaggerated G-pen ink strokes with extreme thick-to-thin pressure variations. "
            f"No uniform thick black lines; instead, it features dynamic colored outlines that change color based on the local color of the body part "
            f"(e.g. dark maroon outline on red areas, dark beige outline on skin, dark charcoal on clothing). "
            f"The character is colored in highly muted, desaturated tones (charcoal, dark olive, pale gray, beige), while the background is a solid vibrant {r['color']} "
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
        print(f"Submitting [{idx+1}/4] Ver A task for {t['en']} with top margin...")
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
    timeout = 900 # 15 minutes
    
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
                            
                            # Overlay label to the Ver A folder
                            overlay_card_labels(raw_path, out_path, info["jp"], info["en"])
                            
                            # Also copy raw to main raw-illustrations-72 and generated-cards-72 for consistency
                            raw_72 = f"/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72/{r_id}_ver_a.png"
                            out_72 = f"/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72/{r_id}_ver_a.png"
                            shutil.copy2(raw_path, raw_72)
                            shutil.copy2(out_path, out_72)
                            
                            completed[r_id] = out_path
                            print(f"  Successfully finished redrawing {r_id}_ver_a.")
                        else:
                            print(f"  No URL for {r_id}_ver_a")
                            failed.append(r_id)
                    elif status in ["fail", "error"]:
                        print(f"  Failed on KIE.AI for {r_id}_ver_a")
                        failed.append(r_id)
            except Exception as e:
                print(f"  Polling error for {r_id}_ver_a: {e}")
                
        print(f"Progress: {len(completed)} completed, {len(failed)} failed out of {len(task_map)}")

    print("\n--- Upper Space Redraw Finished ---")
    print(f"Successfully Redrawn: {len(completed)}")

if __name__ == "__main__":
    main()
