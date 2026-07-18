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

# Redefine the roles for quick lookup
roles_dict = {
    "knights": {"jp": "騎士団", "en": "Knights", "color": "cobalt blue", "desc": "three noble guardians in heavy steel plate armor, standing side-by-side with large oval shields, no weapons"},
    "double": {"jp": "影武者", "en": "Double", "color": "deep violet", "desc": "a mysterious young man in a long coat, creating multiple glowing dark visual illusions of himself in the background"},
    "counselor": {"jp": "カウンセラー", "en": "Counselor", "color": "emerald green", "desc": "a sophisticated gentleman with wavy hair, wearing a high-collared coat, holding a closed vintage book with a wise owl on his shoulder"},
    "necromancer": {"jp": "霊媒師", "en": "Necromancer", "color": "hot pink", "desc": "a mystical female shaman in a starry gown, raising her hands to summon glowing magic wisps of light, no bones"},
    "dictator": {"jp": "独裁者", "en": "Dictator", "color": "navy blue", "desc": "a commanding leader in a formal dark dress uniform with gold embroidery, standing tall on a high balcony holding a golden scepter"},
    "trapper": {"jp": "罠師", "en": "Trapper", "color": "mustard yellow", "desc": "a stealthy forest ranger wearing a hood and mask, crouching on a thick tree branch, holding a mechanical device"},
    "citizen": {"jp": "市民", "en": "Citizen", "color": "slate blue", "desc": "a young rustic farmer holding a glowing oil lantern, standing beside a young village girl under a crescent moon"},
    "prophet": {"jp": "予言者", "en": "Prophet", "color": "forest green", "desc": "a wise old sage with a long white beard, sitting on a high wooden chair, holding a glowing green crystal sphere"},
    "bodyguard": {"jp": "ボディガード", "en": "Bodyguard", "color": "safety orange", "desc": "a muscular bald protector in leather vest armor, standing firm with a massive round metal shield in front of him, no weapons"},
    "twins": {"jp": "共有者", "en": "Twins", "color": "teal", "desc": "two young sisters holding hands, wearing matching dresses with big hairbows"},
    "magician": {"jp": "奇術師", "en": "Magician", "color": "purple", "desc": "a charismatic stage magician in a checkered vest and cape, holding a floating glowing playing card, no weapons"},
    "hunter": {"jp": "ハンター", "en": "Hunter", "color": "olive drab", "desc": "a rugged veteran tracker wearing a hooded cloak, hiding in forest foliage, holding a wooden walking staff, no weapons"},
    "tough_guy": {"jp": "タフガイ", "en": "Tough guy", "color": "chocolate brown", "desc": "a muscular blacksmith holding a heavy metal hammer over a hot glowing anvil"},
    "spy": {"jp": "スパイ", "en": "Spy", "color": "charcoal black", "desc": "a sleek female spy in a leather trench coat, crouching on a steel girder looking down, holding a small key"},
    "betrayal_twin": {"jp": "裏切りの共有者", "en": "Betrayal twin", "color": "fuchsia", "desc": "two young sisters standing close together, wearing dark frilly dresses, looking down with a sharp gaze"},
    "werewolf": {"jp": "人狼", "en": "Werewolf", "color": "crimson red", "desc": "a ferocious, muscular werewolf wearing a torn leather jacket, crouching on concrete ruins, with a mysterious intense gaze"},
    "traitor": {"jp": "内通者", "en": "Traitor", "color": "amber orange", "desc": "a mysterious man in a wide-brimmed fedora and trench coat, writing in a small notebook while smoking"},
    "betrayer": {"jp": "裏切り者", "en": "Betrayer", "color": "lime green", "desc": "a shady man in a dark coat leaning on a brick wall, holding a handful of gold coins and smiling slyly"},
    "werewolf_child": {"jp": "人狼の子ども", "en": "Werewolf's child", "color": "scarlet red", "desc": "a playful young wolf pup running forward happily, wearing a black shirt with a yellow lightning symbol"},
    "android": {"jp": "アンドロイド", "en": "Android", "color": "cyan blue", "desc": "a futuristic android robot with glowing circuitry patterns on its metallic body, standing against a round holographic interface"},
    "lone_wolf": {"jp": "一匹狼", "en": "Lone wolf", "color": "dark slate", "desc": "a lone wolf character in a dark hooded vest, standing on a high building edge, holding a theater comedy mask"},
    "god": {"jp": "神様", "en": "God", "color": "gold", "desc": "a celestial golden guardian floating in a meditative pose, surrounded by floating energy orbs"},
    "lovers": {"jp": "恋人", "en": "Lovers", "color": "rose red", "desc": "a stylish young man and woman leaning against each other passionately"},
    "mysterious_fox": {"jp": "妖狐", "en": "Mysterious fox", "color": "dusty pink", "desc": "an elegant white fox character in a dark dress, standing near a ruined iron fence under a crescent moon, multiple soft tails"}
}

# 3 Uniform Directions with MILDER, FILTER-SAFE descriptions
directions_dict = {
    "a": {
        "ver": "a",
        "jp_suffix": " A",
        "en_suffix": " A",
        "pose_desc": "posing back-to-back, exhibiting highly slender stylized limbs and beautifully elongated artistic fingers, tilted pelvis"
    },
    "b": {
        "ver": "b",
        "jp_suffix": " B",
        "en_suffix": " B",
        "pose_desc": "standing in a highly asymmetrical front pose, with a beautifully tilted head angle, holding a key signature tool close to chest"
    },
    "c": {
        "ver": "c",
        "jp_suffix": " C",
        "en_suffix": " C",
        "pose_desc": "standing tall in a theatrical side-profile pose, shoulders at uneven asymmetrical heights, looking over shoulder with a sharp intense gaze"
    }
}

failed_tasks = [
    {"role": "knights", "ver": "a"},
    {"role": "counselor", "ver": "a"},
    {"role": "counselor", "ver": "b"},
    {"role": "trapper", "ver": "c"},
    {"role": "citizen", "ver": "a"},
    {"role": "bodyguard", "ver": "b"},
    {"role": "magician", "ver": "a"},
    {"role": "magician", "ver": "b"},
    {"role": "tough_guy", "ver": "c"},
    {"role": "betrayal_twin", "ver": "b"},
    {"role": "betrayal_twin", "ver": "c"}, # Also retry Ver C just in case it timed out
    {"role": "werewolf", "ver": "b"},
    {"role": "betrayer", "ver": "c"},
    {"role": "werewolf_child", "ver": "c"},
    {"role": "mysterious_fox", "ver": "c"}
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
    print(f"Retrying failed tasks: {len(failed_tasks)} remaining...")
    
    # 1. Queue all retry tasks
    task_map = {}
    for t in failed_tasks:
        r = roles_dict[t["role"]]
        d = directions_dict[t["ver"]]
        id_key = f"{t['role']}_ver_{t['ver']}"
        jp_label = f"{r['jp']}{d['jp_suffix']}"
        en_label = f"{r['en']}{d['en_suffix']}"
        
        prompt = (
            f"A stylized hand-drawn high-fashion graphic art of {r['desc']}, {d['pose_desc']}. "
            f"Exaggerated G-pen ink strokes with extreme thick-to-thin pressure variations. "
            f"No uniform thick black lines; instead, it features dynamic colored outlines that change color based on the local color of the body part "
            f"(e.g. dark maroon outline on red areas, dark beige outline on skin, dark charcoal on clothing, fading to lighter tones at edges). "
            f"The character is colored in highly muted, desaturated tones (charcoal, dark olive, pale gray, beige), while the background is a solid vibrant {r['color']} "
            f"(creating a stark contrast between character and backdrop). "
            f"Full screen bleed, no borders. Absolutely not anime, not realistic. Aspect ratio 9:16."
        )
        
        print(f"Submitting retry task for {en_label}...")
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
                    print(f"  Submitted {id_key}: Task ID = {task_id}")
                    break
                else:
                    print(f"  Error (try {try_idx+1}/3): {res_json}")
                    time.sleep(3)
            except Exception as e:
                print(f"  Exception (try {try_idx+1}/3): {e}")
                time.sleep(3)
                
        if task_id:
            task_map[id_key] = {
                "taskId": task_id,
                "jp": jp_label,
                "en": en_label
            }
        time.sleep(2.5)
        
    print(f"\nAll retry tasks submitted. Running polling loop for {len(task_map)} tasks...")
    
    completed = {}
    failed = []
    start_time = time.time()
    timeout = 900 # 15 minutes timeout
    
    while len(completed) + len(failed) < len(task_map):
        if time.time() - start_time > timeout:
            print("Retry session timeout!")
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
                    print(f"Retry Task {id_key} status: {status}")
                    
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
                            
                            out_path = os.path.join(OUT_DIR, f"{id_key}.png")
                            overlay_card_labels(save_path, out_path, info["jp"], info["en"])
                            
                            completed[id_key] = out_path
                            print(f"  Successfully finished {id_key}.")
                        else:
                            print(f"  No URL for {id_key}")
                            failed.append(id_key)
                    elif status in ["fail", "error"]:
                        print(f"  Failed on KIE.AI for {id_key}")
                        failed.append(id_key)
            except Exception as e:
                print(f"  Polling error for {id_key}: {e}")
                
        print(f"Retry Progress: {len(completed)} completed, {len(failed)} failed out of {len(task_map)}")

    print("\n--- Retry Session Finished ---")
    print(f"Successfully Recovered: {len(completed)}")
    print(f"Unrecoverable: {len(failed)}")

if __name__ == "__main__":
    main()
