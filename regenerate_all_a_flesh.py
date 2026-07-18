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

os.makedirs(RAW_A_DIR, exist_ok=True)
os.makedirs(OUT_A_DIR, exist_ok=True)

# 24 Roles definition (with updated descriptions to completely eliminate skeleton bones)
roles = [
    # Citizen Team
    {"id": "knights", "jp": "騎士団", "en": "Knights", "color": "cobalt blue", "desc": "three noble guardians in heavy steel plate armor, standing side-by-side with large oval shields, no weapons"},
    {"id": "double", "jp": "影武者", "en": "Double", "color": "deep violet", "desc": "a mysterious young man in a long coat, creating multiple glowing dark visual illusions of himself in the background"},
    {"id": "counselor", "jp": "カウンセラー", "en": "Counselor", "color": "emerald green", "desc": "a sophisticated gentleman with wavy hair wearing a high-collared coat, showing a mysterious face"},
    {"id": "necromancer", "jp": "霊媒師", "en": "Necromancer", "color": "hot pink", "desc": "a mystical female shaman in a starry gown, raising her hands to summon glowing magic wisps of light"},
    {"id": "dictator", "jp": "独裁者", "en": "Dictator", "color": "navy blue", "desc": "a commanding leader in a formal dark dress uniform with gold embroidery, standing tall on a high balcony holding a golden scepter"},
    {"id": "trapper", "jp": "罠師", "en": "Trapper", "color": "mustard yellow", "desc": "a stealthy forest ranger wearing a hooded cloak, holding a small glowing green crystal stone"},
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
    {"id": "werewolf_child", "jp": "人狼の子ども", "en": "Werewolf's child", "color": "scarlet red", "desc": "a ferocious young werewolf boy with dark wolf ears and glowing eyes, wearing a torn black vest over a desaturated shirt"},
    
    # Third Party
    {"id": "android", "jp": "アンドロイド", "en": "Android", "color": "cyan blue", "desc": "a futuristic android robot with glowing circuitry patterns on its metallic body, standing against a round holographic interface"},
    {"id": "lone_wolf", "jp": "一匹狼", "en": "Lone wolf", "color": "dark slate", "desc": "a lone wolf character in a dark hooded vest, standing on a high building edge, holding a theater comedy mask"},
    {"id": "god", "jp": "神様", "en": "God", "color": "gold", "desc": "a celestial golden guardian floating in a meditative pose, surrounded by floating energy orbs"},
    {"id": "lovers", "jp": "恋人", "en": "Lovers", "color": "rose red", "desc": "a stylish young man and woman leaning against each other passionately"},
    {"id": "mysterious_fox", "jp": "妖狐", "en": "Mysterious fox", "color": "dusty pink", "desc": "an elegant white fox character in a dark dress, standing near a ruined iron fence under a crescent moon, multiple soft tails"}
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
    print("Starting generation for ALL 24 Ver.A cards with flesh-covered bodies (no exposed bones)...")
    
    tasks_to_submit = []
    for r in roles:
        # Define clean flesh posing: back-to-back, fully covered normal skin/flesh limbs (absolutely no skeleton or bare bones)
        pose_desc = (
            "posing back-to-back, featuring a fully covered normal flesh and skin body but with hyper-slender, elongated, and slightly twisted artistic limbs and fingers, showcasing a stylized thin posture. "
            "Absolutely no exposed bones, no skeletal body parts, no skeleton imagery"
        )
        
        prompt = (
            f"A stylized hand-drawn high-fashion graphic art of {r['desc']}, {pose_desc}. "
            f"Exaggerated G-pen ink strokes with extreme thick-to-thin pressure variations. "
            f"No uniform thick black lines; instead, it features dynamic colored outlines that change color based on the local color of the body part "
            f"(e.g. dark maroon outline on red areas, dark beige outline on skin, dark charcoal on clothing, fading to lighter tones at edges). "
            f"The character is colored in highly muted, desaturated tones (charcoal, dark olive, pale gray, beige), while the background is a solid vibrant {r['color']} "
            f"(creating a stark contrast between character and backdrop). "
            f"Full screen bleed, no borders. Absolutely not anime, not realistic. Aspect ratio 9:16."
        )
        
        tasks_to_submit.append({
            "id": r["id"],
            "jp": f"{r['jp']} A",
            "en": f"{r['en']} A",
            "prompt": prompt
        })

    # 1. Submit tasks
    task_map = {}
    for idx, t in enumerate(tasks_to_submit):
        print(f"Submitting [{idx+1}/24] Ver A task for {t['en']}...")
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
    timeout = 1800 # 30 minutes
    
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
                
        print(f"Flesh Redraw Progress: {len(completed)} completed, {len(failed)} failed out of {len(task_map)}")

    print("\n--- Flesh Redraw Session Finished ---")
    print(f"Successfully Redrawn: {len(completed)}")
    print(f"Failed/Need manual: {len(failed)}")

if __name__ == "__main__":
    main()
