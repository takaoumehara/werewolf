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

RAW_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72"
OUT_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72"

RAW_A_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72-a"
OUT_A_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72-a"

os.makedirs(RAW_DIR, exist_ok=True)
os.makedirs(OUT_DIR, exist_ok=True)
os.makedirs(RAW_A_DIR, exist_ok=True)
os.makedirs(OUT_A_DIR, exist_ok=True)

# 3 New Prompts matching werewolf_ver_a style (Gritty, G-pen, desaturated tones, leather clothing, dark wolf features, not a pup)
werewolf_child_variants = [
    {
        "ver": "a",
        "jp": "人狼の子ども A",
        "en": "Werewolf's child A",
        "prompt": "A stylized hand-drawn high-fashion graphic art of a ferocious young werewolf boy with dark wolf ears and glowing eyes, wearing a torn black vest over a desaturated shirt, posing back-to-back, exhibiting highly slender stylized limbs and beautifully elongated artistic claw fingers, tilted pelvis. Exaggerated G-pen ink strokes with extreme thick-to-thin pressure variations. No uniform thick black lines; instead, it features dynamic colored outlines that change color based on the local color of the body part (e.g. dark crimson outline on red areas, dark beige outline on skin, dark charcoal on clothing). The character is colored in highly muted, desaturated tones (charcoal, dark olive, pale gray, beige), while the background is a solid vibrant scarlet red (creating a stark contrast between character and backdrop). Full screen bleed, no borders. Absolutely not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "ver": "b",
        "jp": "人狼の子ども B",
        "en": "Werewolf's child B",
        "prompt": "A stylized hand-drawn high-fashion graphic art of a ferocious young werewolf boy with dark wolf ears and glowing eyes, wearing a torn black vest over a desaturated shirt, standing in a highly asymmetrical front pose, with a beautifully tilted head angle, holding a small dark claw tooth close to chest. Exaggerated G-pen ink strokes with extreme thick-to-thin pressure variations. No uniform thick black lines; instead, it features dynamic colored outlines that change color based on the local color of the body part (e.g. dark crimson outline on red areas, dark beige outline on skin, dark charcoal on clothing). The character is colored in highly muted, desaturated tones (charcoal, dark olive, pale gray, beige), while the background is a solid vibrant scarlet red. Full screen bleed, no borders. Absolutely not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "ver": "c",
        "jp": "人狼の子ども C",
        "en": "Werewolf's child C",
        "prompt": "A stylized hand-drawn high-fashion graphic art of a ferocious young werewolf boy with dark wolf ears and glowing eyes, wearing a torn black vest over a desaturated shirt, standing tall in a theatrical side-profile pose, shoulders at uneven asymmetrical heights, looking over shoulder with a sharp intense gaze. Exaggerated G-pen ink strokes with extreme thick-to-thin pressure variations. No uniform thick black lines; instead, it features dynamic colored outlines that change color based on the local color of the body part (e.g. dark crimson outline on red areas, dark beige outline on skin, dark charcoal on clothing). The character is colored in highly muted, desaturated tones (charcoal, dark olive, pale gray, beige), while the background is a solid vibrant scarlet red. Full screen bleed, no borders. Absolutely not anime, not realistic. Aspect ratio 9:16."
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
    print("Starting generation for Werewolf's Child variants (Gritty Werewolf Style)...")
    
    # 1. Submit tasks
    task_map = {}
    for t in werewolf_child_variants:
        print(f"Submitting task for Werewolf's child Ver {t['ver'].upper()}...")
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
                    print(f"  Submitted werewolf_child_ver_{t['ver']}: Task ID = {task_id}")
                    break
                else:
                    print(f"  Error (try {try_idx+1}/3): {res_json}")
                    time.sleep(3)
            except Exception as e:
                print(f"  Exception (try {try_idx+1}/3): {e}")
                time.sleep(3)
                
        if task_id:
            task_map[t["ver"]] = {
                "taskId": task_id,
                "jp": t["jp"],
                "en": t["en"]
            }
        time.sleep(2.5)
        
    print(f"\nAll tasks submitted. Running polling loop for {len(task_map)} tasks...")
    
    completed = {}
    failed = []
    start_time = time.time()
    timeout = 600
    
    while len(completed) + len(failed) < len(task_map):
        if time.time() - start_time > timeout:
            print("Session timeout!")
            break
            
        time.sleep(15)
        
        for ver, info in task_map.items():
            if ver in completed or ver in failed:
                continue
                
            task_id = info["taskId"]
            try:
                r = requests.get(f"{API_URL}/jobs/recordInfo?taskId={task_id}", headers=HEADERS, timeout=15)
                res_json = r.json()
                if r.status_code == 200 and res_json.get("code") == 200:
                    data = res_json.get("data", {})
                    status = data.get("state")
                    print(f"Task Werewolf Child {ver} status: {status}")
                    
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
                            # 1. Save to 72 folder
                            raw_72 = os.path.join(RAW_DIR, f"werewolf_child_ver_{ver}.png")
                            out_72 = os.path.join(OUT_DIR, f"werewolf_child_ver_{ver}.png")
                            print(f"  Downloading Ver {ver.upper()}...")
                            img_data = requests.get(url, timeout=30).content
                            with open(raw_72, 'wb') as f:
                                f.write(img_data)
                            
                            # Render labeled card to 72 folder
                            overlay_card_labels(raw_72, out_72, info["jp"], info["en"])
                            
                            # 2. If it is Ver A, copy to -a folder as well
                            if ver == "a":
                                raw_a = os.path.join(RAW_A_DIR, "werewolf_child_ver_a.png")
                                out_a = os.path.join(OUT_A_DIR, "werewolf_child_ver_a.png")
                                import shutil
                                shutil.copy2(raw_72, raw_a)
                                overlay_card_labels(raw_a, out_a, info["jp"], info["en"])
                                print("  Copied Ver A to -a folders.")
                                
                            completed[ver] = out_72
                            print(f"  Successfully finished Werewolf Child {ver}.")
                        else:
                            print(f"  No URL for Ver {ver}")
                            failed.append(ver)
                    elif status in ["fail", "error"]:
                        print(f"  Failed on KIE.AI for Ver {ver}")
                        failed.append(ver)
            except Exception as e:
                print(f"  Polling error for Ver {ver}: {e}")
                
        print(f"Progress: {len(completed)} completed, {len(failed)} failed out of {len(task_map)}")

    print("\n--- Redraw Werewolf Child Finished ---")
    print(f"Successfully Redrawn: {len(completed)}")

if __name__ == "__main__":
    main()
