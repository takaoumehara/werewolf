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

RAW_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72"
OUT_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72"

# 24 Roles definition with their specific details and color assignments
roles = [
    # Citizen Team
    {"id": "knights", "jp": "騎士団", "en": "Knights", "color": "cobalt blue", "desc": "three noble guardians in heavy steel plate armor, standing side-by-side with large oval shields, no weapons"},
    {"id": "double", "jp": "影武者", "en": "Double", "color": "deep violet", "desc": "a mysterious young man in a long coat, creating multiple glowing dark visual illusions of himself in the background"},
    {"id": "counselor", "jp": "カウンセラー", "en": "Counselor", "color": "emerald green", "desc": "a sophisticated gentleman with wavy hair, wearing a high-collared coat, holding a closed vintage book with a wise owl on his shoulder"},
    {"id": "necromancer", "jp": "霊媒師", "en": "Necromancer", "color": "hot pink", "desc": "a mystical female shaman in a starry gown, raising her hands to summon glowing magic wisps of light, no bones"},
    {"id": "dictator", "jp": "独裁者", "en": "Dictator", "color": "navy blue", "desc": "a commanding leader in a formal dark dress uniform with gold embroidery, standing tall on a high balcony holding a golden scepter"},
    {"id": "trapper", "jp": "罠師", "en": "Trapper", "color": "mustard yellow", "desc": "a stealthy forest ranger wearing a hood and mask, crouching on a thick tree branch, holding a mechanical device"},
    {"id": "citizen", "jp": "市民", "en": "Citizen", "color": "slate blue", "desc": "a young rustic farmer holding a glowing oil lantern, standing beside a young village girl under a crescent moon"},
    {"id": "prophet", "jp": "予言者", "en": "Prophet", "color": "forest green", "desc": "a wise old sage with a long white beard, sitting on a high wooden chair, holding a glowing green crystal sphere"},
    {"id": "bodyguard", "jp": "ボディガード", "en": "Bodyguard", "color": "safety orange", "desc": "a muscular bald protector in leather vest armor, standing firm with a massive round metal shield in front of him, no weapons"},
    {"id": "twins", "jp": "共有者", "en": "Twins", "color": "teal", "desc": "two young sisters holding hands, wearing matching dresses with big hairbows"},
    {"id": "magician", "jp": "奇術師", "en": "Magician", "color": "purple", "desc": "a charismatic stage magician in a checkered vest and cape, holding a floating glowing playing card, no weapons"},
    {"id": "hunter", "jp": "ハンター", "en": "Hunter", "color": "olive drab", "desc": "a rugged veteran tracker wearing a hooded cloak, hiding in forest foliage, holding a wooden walking staff, no weapons"},
    {"id": "tough_guy", "jp": "タフガイ", "en": "Tough guy", "color": "chocolate brown", "desc": "a muscular blacksmith holding a heavy metal hammer over a hot glowing anvil"},
    
    # Werewolf Team
    {"id": "spy", "jp": "スパイ", "en": "Spy", "color": "charcoal black", "desc": "a sleek female spy in a leather trench coat, crouching on a steel girder looking down, holding a small key"},
    {"id": "betrayal_twin", "jp": "裏切りの共有者", "en": "Betrayal twin", "color": "fuchsia", "desc": "two young sisters standing close together, wearing dark frilly dresses, looking down with a sharp gaze"},
    {"id": "werewolf", "jp": "人狼", "en": "Werewolf", "color": "crimson red", "desc": "a ferocious, muscular werewolf wearing a torn leather jacket, crouching on concrete ruins, snarling"},
    {"id": "traitor", "jp": "内通者", "en": "Traitor", "color": "amber orange", "desc": "a mysterious man in a wide-brimmed fedora and trench coat, writing in a small notebook while smoking"},
    {"id": "betrayer", "jp": "裏切り者", "en": "Betrayer", "color": "lime green", "desc": "a shady man in a dark coat leaning on a brick wall, holding a handful of gold coins and smiling slyly"},
    {"id": "werewolf_child", "jp": "人狼の子ども", "en": "Werewolf's child", "color": "scarlet red", "desc": "a playful young wolf pup running forward happily, wearing a black shirt with a yellow lightning symbol"},
    
    # Third Party
    {"id": "android", "jp": "アンドロイド", "en": "Android", "color": "cyan blue", "desc": "a futuristic android robot with glowing circuitry patterns on its metallic body, standing against a round holographic interface"},
    {"id": "lone_wolf", "jp": "一匹狼", "en": "Lone wolf", "color": "dark slate", "desc": "a lone wolf character in a dark hooded vest, standing on a high building edge, holding a theater comedy mask"},
    {"id": "god", "jp": "神様", "en": "God", "color": "gold", "desc": "a celestial golden guardian floating in a meditative pose, surrounded by floating energy orbs"},
    {"id": "lovers", "jp": "恋人", "en": "Lovers", "color": "rose red", "desc": "a stylish young man and woman leaning against each other passionately"},
    {"id": "mysterious_fox", "jp": "妖狐", "en": "Mysterious fox", "color": "dusty pink", "desc": "an elegant white fox character in a dark dress, standing near a ruined iron fence under a crescent moon, multiple soft tails"}
]

# 3 Uniform Directions
directions = [
    {
        "ver": "a",
        "jp_suffix": " A",
        "en_suffix": " A",
        "pose_desc": "posing back-to-back, exhibiting highly twisted skeletal-like thin limbs and unnaturally elongated artistic fingers, tilted pelvis"
    },
    {
        "ver": "b",
        "jp_suffix": " B",
        "en_suffix": " B",
        "pose_desc": "standing in a highly asymmetrical front pose, with a tilted slightly uncanny head angle, holding a key signature tool close to chest"
    },
    {
        "ver": "c",
        "jp_suffix": " C",
        "en_suffix": " C",
        "pose_desc": "standing tall in a theatrical side-profile pose, shoulders at uneven asymmetrical heights, looking over shoulder with a sharp intense gaze"
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
    print("Clearing output directories for 72-card generation...")
    if os.path.exists(RAW_DIR):
        shutil.rmtree(RAW_DIR)
    if os.path.exists(OUT_DIR):
        shutil.rmtree(OUT_DIR)
    os.makedirs(RAW_DIR, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)

    # 1. Generate all 72 task inputs
    tasks_to_submit = []
    for r in roles:
        for d in directions:
            task_id_key = f"{r['id']}_ver_{d['ver']}"
            jp_label = f"{r['jp']}{d['jp_suffix']}"
            en_label = f"{r['en']}{d['en_suffix']}"
            
            # Format prompt utilizing the Fox-style matrix (colored outlines, extreme thick-thin lines, desaturated tones against solid background)
            prompt = (
                f"A stylized hand-drawn high-fashion graphic art of {r['desc']}, {d['pose_desc']}. "
                f"Exaggerated G-pen ink strokes with extreme thick-to-thin pressure variations. "
                f"No uniform thick black lines; instead, it features dynamic colored outlines that change color based on the local color of the body part "
                f"(e.g. dark maroon outline on red areas, dark beige outline on skin, dark charcoal on clothing, fading to lighter tones at edges). "
                f"The character is colored in highly muted, desaturated tones (charcoal, dark olive, pale gray, beige), while the background is a solid vibrant {r['color']} "
                f"(creating a stark contrast between character and backdrop). "
                f"Full screen bleed, no borders. Absolutely not anime, not realistic. Aspect ratio 9:16."
            )
            
            tasks_to_submit.append({
                "id_key": task_id_key,
                "jp": jp_label,
                "en": en_label,
                "prompt": prompt
            })

    print(f"Total tasks prepared: {len(tasks_to_submit)}")
    
    # 2. Submit tasks sequentially (using a delay to prevent API overloading)
    task_map = {}
    for idx, t in enumerate(tasks_to_submit):
        print(f"Submitting [{idx+1}/{len(tasks_to_submit)}] task for {t['en']}...")
        payload = {
            "model": "flux-2/pro-text-to-image",
            "input": {
                "prompt": t["prompt"],
                "aspect_ratio": "9:16",
                "resolution": "1K"
            }
        }
        
        task_id = None
        retries = 3
        for r_idx in range(retries):
            try:
                response = requests.post(f"{API_URL}/jobs/createTask", json=payload, headers=HEADERS, timeout=30)
                res_json = response.json()
                if response.status_code == 200 and res_json.get("code") == 200:
                    task_id = res_json.get("data", {}).get("taskId")
                    print(f"  Submitted {t['id_key']}: Task ID = {task_id}")
                    break
                else:
                    print(f"  API Error (try {r_idx+1}/{retries}): {res_json}")
                    time.sleep(3)
            except Exception as e:
                print(f"  HTTP Exception (try {r_idx+1}/{retries}): {e}")
                time.sleep(3)
                
        if task_id:
            task_map[t["id_key"]] = {
                "taskId": task_id,
                "jp": t["jp"],
                "en": t["en"]
            }
        time.sleep(2.5) # Prevent 429
        
    print(f"\nAll tasks submitted. Successfully queued: {len(task_map)} / {len(tasks_to_submit)}")
    
    # 3. Polling loop
    completed = {}
    failed = []
    start_time = time.time()
    timeout = 2400 # 40 minutes timeout for 72 tasks
    
    while len(completed) + len(failed) < len(task_map):
        if time.time() - start_time > timeout:
            print("Global polling timeout reached!")
            break
            
        time.sleep(15)
        
        for id_key, info in task_map.items():
            if id_key in completed or id_key in failed:
                continue
                
            task_id = info["taskId"]
            try:
                r = requests.get(f"{API_URL}/jobs/recordInfo?taskId={task_id}", headers=HEADERS, timeout=15)
                res_json = r.json()
                if r.status_code == 200 and res_json.get("code") == 200:
                    data = res_json.get("data", {})
                    status = data.get("state")
                    print(f"Task {id_key} status: {status}")
                    
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
                            save_path = os.path.join(RAW_DIR, f"{id_key}.png")
                            print(f"  Downloading {id_key}...")
                            img_data = requests.get(url, timeout=30).content
                            with open(save_path, 'wb') as f:
                                f.write(img_data)
                            
                            # Synthetic Overlay
                            out_path = os.path.join(OUT_DIR, f"{id_key}.png")
                            overlay_card_labels(save_path, out_path, info["jp"], info["en"])
                            
                            completed[id_key] = out_path
                            print(f"  Done overlaying for {id_key}.")
                        else:
                            print(f"  Error: success status but no URL found for {id_key}")
                            failed.append(id_key)
                    elif status in ["fail", "error"]:
                        print(f"  Error: task failed on KIE.AI for {id_key}")
                        failed.append(id_key)
            except Exception as e:
                print(f"  Polling Exception for {id_key}: {e}")
                
        print(f"Total 72-Card Progress: {len(completed)} completed, {len(failed)} failed out of {len(task_map)}")
        
    print("\n--- 72-Card Generation Session Finished ---")
    print(f"Total Successfully Created: {len(completed)}")
    print(f"Total Failed: {len(failed)}")

if __name__ == "__main__":
    main()
