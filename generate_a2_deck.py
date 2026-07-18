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

RAW_A2_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72-a2"
OUT_A2_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72-a2"

os.makedirs(RAW_A2_DIR, exist_ok=True)
os.makedirs(OUT_A2_DIR, exist_ok=True)

# 24 Roles with customized background illustration descriptions in matching color tones
roles_a2 = [
    {
        "id": "dictator", "jp": "独裁者 A", "en": "Dictator A", "color": "vibrant dark blue",
        "bg": "a solid vibrant dark blue background filled with subtle hand-drawn palace arches and starry night silhouettes in the same blue tones",
        "char": "a sophisticated single dictator gentleman in a military uniform standing on a balcony, holding a golden scepter"
    },
    {
        "id": "knights", "jp": "騎士団 A", "en": "Knights A", "color": "sky blue",
        "bg": "a sky blue background featuring a subtle castle fortress rampart and shields in matching blue tones",
        "char": "three valiant knights standing side-by-side"
    },
    {
        "id": "double", "jp": "影武者 A", "en": "Double A", "color": "cyan",
        "bg": "a cyan background decorated with subtle shadow mirror silhouettes in cyan tones",
        "char": "a single mysterious double character in shadow, wearing a dark hood and holding a silver dagger"
    },
    {
        "id": "counselor", "jp": "カウンセラー A", "en": "Counselor A", "color": "emerald green",
        "bg": "an emerald green background decorated with abstract hand-drawn counseling room bookshelves or green organic plant outlines in matching emerald green tones",
        "char": "a sophisticated single gentleman with wavy hair wearing a high-collared coat"
    },
    {
        "id": "necromancer", "jp": "霊媒師 A", "en": "Necromancer A", "color": "hot pink",
        "bg": "a hot pink background featuring glowing magic circle runes and mystical spell patterns in hot pink tones",
        "char": "a mystical single female shaman in a starry gown, summoning glowing magic wisps"
    },
    {
        "id": "trapper", "jp": "罠師 A", "en": "Trapper A", "color": "lime green",
        "bg": "a lime green background showing a subtle forest undergrowth, leaves, and vine silhouettes in lime green tones",
        "char": "a single trapper laying traps"
    },
    {
        "id": "citizen", "jp": "市民 A", "en": "Citizen A", "color": "teal",
        "bg": "a teal background with subtle silhouettes of a peaceful village and simple houses in matching teal tones",
        "char": "two friendly citizen characters standing side-by-side"
    },
    {
        "id": "prophet", "jp": "予言者 A", "en": "Prophet A", "color": "purple",
        "bg": "a purple background showing a large glowing crystal ball silhouette and mystic stars in purple tones",
        "char": "a single prophet looking at a crystal ball"
    },
    {
        "id": "bodyguard", "jp": "ボディガード A", "en": "Bodyguard A", "color": "dark gray",
        "bg": "a dark gray background featuring a subtle iron shield and gate outline in dark gray tones",
        "char": "a single bodyguard holding a shield"
    },
    {
        "id": "twins", "jp": "共有者 A", "en": "Twins A", "color": "gold",
        "bg": "a gold background decorated with two matching golden keys and light patterns in matching gold tones",
        "char": "two friendly twin characters standing side-by-side"
    },
    {
        "id": "magician", "jp": "奇術師 A", "en": "Magician A", "color": "violet",
        "bg": "a violet background showing subtle playing cards and magic hats floating in matching violet tones",
        "char": "a single magician floating playing cards"
    },
    {
        "id": "hunter", "jp": "ハンター A", "en": "Hunter A", "color": "deep green",
        "bg": "a deep green background featuring subtle tree silhouettes and crossing hunter rifles in deep green tones",
        "char": "a single hunter holding a rifle"
    },
    {
        "id": "tough_guy", "jp": "タフガイ A", "en": "Tough guy A", "color": "olive green",
        "bg": "an olive green background featuring simple military brick wall textures in olive green tones",
        "char": "a tough guy with scars"
    },
    {
        "id": "spy", "jp": "スパイ A", "en": "Spy A", "color": "black",
        "bg": "a pure black background featuring dark gray shadows and industrial factory steel girders in the background",
        "char": "a single spy on a steel girder"
    },
    {
        "id": "betrayal_twin", "jp": "裏切りの共有者 A", "en": "Betrayal Twin A", "color": "deep blue",
        "bg": "a deep blue background showing subtle dark blue roses and thorns in the background",
        "char": "two devious twin characters standing side-by-side, whispering to each other"
    },
    {
        "id": "werewolf", "jp": "人狼 A", "en": "Werewolf A", "color": "red",
        "bg": "a blood red background showing a giant red crescent moon and dead branch silhouettes in blood red tones",
        "char": "a single werewolf"
    },
    {
        "id": "traitor", "jp": "内通者 A", "en": "Traitor A", "color": "orange",
        "bg": "an orange background showing subtle street lamp silhouettes and brick alley walls in orange tones",
        "char": "a traitor gentleman in trench coat and fedora hat, smoking a cigarette"
    },
    {
        "id": "betrayer", "jp": "裏切り者 A", "en": "Betrayer A", "color": "dark purple",
        "bg": "a dark purple background decorated with dark purple flame silhouettes and shadows",
        "char": "a single betrayer in purple flames"
    },
    {
        "id": "werewolf_child", "jp": "人狼の子ども A", "en": "Werewolf's child A", "color": "magenta",
        "bg": "a magenta background showing cute but creepy little red eyes and magenta sparks",
        "char": "a werewolf child"
    },
    {
        "id": "android", "jp": "アンドロイド A", "en": "Android A", "color": "gray",
        "bg": "a gray background showing subtle neon circuit board traces and technical grids in gray tones",
        "char": "a mechanical android"
    },
    {
        "id": "lone_wolf", "jp": "一匹狼 A", "en": "Lone wolf A", "color": "dark red",
        "bg": "a dark red background showing a single dark red full moon and rocky cliff silhouettes in dark red tones",
        "char": "a single lone wolf"
    },
    {
        "id": "god", "jp": "神様 A", "en": "God A", "color": "bright yellow",
        "bg": "a bright yellow background filled with subtle golden clouds and heavenly light beams in yellow tones",
        "char": "a heavenly god"
    },
    {
        "id": "lovers", "jp": "恋人 A", "en": "Lovers A", "color": "rose red",
        "bg": "a rose red background filled with subtle red flower petals and heart outlines in matching rose red tones",
        "char": "two lovers embracing"
    },
    {
        "id": "mysterious_fox", "jp": "妖狐 A", "en": "Mysterious fox A", "color": "dusty pink",
        "bg": "a dusty pink background filled with a low small crescent moon and iron fence, but with dusty pink clouds added to enhance the atmosphere",
        "char": "a white fox character in dark dress"
    }
];

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
    print("Starting generation for the 72-a2 series (Illustrated backgrounds in matching color tones)...")
    
    tasks_to_submit = []
    for r in roles_a2:
        # Standardize the hyper-slender stylization
        # Force a safe 15% top-clearance spacing directly in prompt to avoid title text collisions
        pose_desc = (
            "posing in a stylized thin posture, featuring a fully covered normal flesh and skin body (no exposed bones, no skeletons) but with hyper-slender, elongated, and slightly twisted artistic limbs. "
            "The character is positioned slightly lower in the frame to ensure the top 15% is clear of head/face/details for title overlay text."
        )
        
        prompt = (
            f"A stylized hand-drawn high-fashion graphic art of {r['char']}, set against {r['bg']}. {pose_desc} "
            f"Exaggerated G-pen ink strokes with extreme thick-to-thin pressure variations. "
            f"No uniform thick black lines; instead, it features dynamic colored outlines that change color based on the local color of the body part. "
            f"The character is colored in highly muted, desaturated tones, while the background details use the same color tones to keep the card color identification clear. "
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
        print(f"Submitting [{idx+1}/{len(tasks_to_submit)}] Ver A2 task for {t['en']}...")
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
                    print(f"  Submitted {t['id']}_ver_a2: Task ID = {task_id}")
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
                    print(f"Task {r_id}_ver_a2 status: {status}")
                    
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
                            raw_path = os.path.join(RAW_A2_DIR, f"{r_id}_ver_a.png") # Same name structure for viewer compatibility
                            out_path = os.path.join(OUT_A2_DIR, f"{r_id}_ver_a.png")
                            print(f"  Downloading {r_id}_ver_a2...")
                            img_data = requests.get(url, timeout=30).content
                            with open(raw_path, 'wb') as f:
                                f.write(img_data)
                            
                            # Overlay card labels
                            overlay_card_labels(raw_path, out_path, info["jp"], info["en"])
                            completed[r_id] = out_path
                            print(f"  Successfully finished redrawing {r_id}_ver_a2 with illustrated background.")
                        else:
                            print(f"  No URL for {r_id}_ver_a2")
                            failed.append(r_id)
                    elif status in ["fail", "error"]:
                        print(f"  Failed on KIE.AI for {r_id}_ver_a2")
                        failed.append(r_id)
            except Exception as e:
                print(f"  Polling error for {r_id}_ver_a2: {e}")
                
        print(f"Progress: {len(completed)} completed, {len(failed)} failed out of {len(task_map)}")

    print("\n--- A2 Background Illustration Finished ---")
    print(f"Successfully Redrawn: {len(completed)}")

if __name__ == "__main__":
    main()
