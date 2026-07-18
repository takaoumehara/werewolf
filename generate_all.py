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

RAW_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations"
OUT_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards"

# 24 Roles with safe but highly hand-drawn ink-brush style prompts.
# Replaces messy/imperfect keywords with positive brush/screenprint textures to pass KIE filters.
roles = [
    # Citizen Team
    {
        "id": "knights", 
        "jp": "騎士団", 
        "en": "Knights", 
        "prompt": "A stylized hand-drawn graphic illustration of three noble guardians standing side-by-side in polished silver armor, holding glowing oval shields in a protective stance, no weapons shown. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited dark blue and silver color palette. Edgy character design, sharp eyes. Simple graphic circular blue moon in the background. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "double", 
        "jp": "影武者", 
        "en": "Double", 
        "prompt": "A stylized hand-drawn graphic illustration of a mysterious young man wearing a dark violet coat, creating multiple glowing purple visual illusions of himself in the background, theatrical pose. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited gray, black, and light purple color palette. Edgy character design, sharp eyes. Simple graphic circular purple moon in the background. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "counselor", 
        "jp": "カウンセラー", 
        "en": "Counselor", 
        "prompt": "A stylized hand-drawn graphic illustration of a sophisticated male counselor with wavy hair, wearing a high-collared coat, sitting on a crescent moon, holding a closed book with a wise owl perched on his shoulder. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited emerald green and beige color palette. Edgy character design, sharp eyes. Background has dark forest tree silhouettes. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "necromancer", 
        "jp": "霊媒師", 
        "en": "Necromancer", 
        "prompt": "A stylized hand-drawn graphic illustration of a mystical female shaman in a starry purple gown, raising her hands to summon glowing magical wisps of pink and purple light, no skeletons or bones. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited violet, black, and hot pink color palette. Edgy character design, sharp eyes. Background has dark forest tree silhouettes and a full pink moon. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "dictator", 
        "jp": "独裁者", 
        "en": "Dictator", 
        "prompt": "A stylized hand-drawn graphic illustration of a charismatic visionary leader in a formal dark blue dress uniform with gold embroidery, standing tall on a high balcony in a commanding posture, holding a golden scepter, no weapons. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited navy blue, white, and gold color palette. Edgy character design, sharp eyes. Background features a giant white crescent moon and spotlight beam silhouettes. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "trapper", 
        "jp": "罠師", 
        "en": "Trapper", 
        "prompt": "A stylized hand-drawn graphic illustration of a stealthy forest ranger wearing a green mask, crouching on a thick tree branch, holding a small glowing mechanical navigation device. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited olive green, black, and bright yellow color palette. Edgy character design, sharp eyes. Background features a large graphical round yellow moon. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "citizen", 
        "jp": "市民", 
        "en": "Citizen", 
        "prompt": "A stylized hand-drawn graphic illustration of a young rustic man holding a vintage oil lantern, standing beside a young woman in protective stance looking alert. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited teal, dark brown, and white color palette. Edgy character design, sharp eyes. Background features a large graphical circular light blue moon and silhouettes of old village roofs. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "prophet", 
        "jp": "予言者", 
        "en": "Prophet", 
        "prompt": "A stylized hand-drawn graphic illustration of an old wise prophet with a long white beard, sitting on a wooden throne, staring intensely, holding a glowing green crystal ball. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited emerald green, dark gray, and white color palette. Edgy character design, sharp eyes. Background features a large graphic yellow moon. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "bodyguard", 
        "jp": "ボディガード", 
        "en": "Bodyguard", 
        "prompt": "A stylized hand-drawn graphic illustration of a muscular bald protector wearing dark leather vest armor, standing firm with a massive round metal shield in front of him, protective stance, no weapons. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited safety orange, olive green, and black color palette. Edgy character design, sharp eyes. Background features a large graphical yellow moon. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "twins", 
        "jp": "共有者", 
        "en": "Twins", 
        "prompt": "A stylized hand-drawn graphic illustration of two gothic lolita twin girls holding hands, wearing matching dresses with big hairbows, standing under a street lamp. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited baby blue, black, and white color palette. Edgy character design, sharp eyes. Background features a large circular glowing white moon. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "magician", 
        "jp": "奇術師", 
        "en": "Magician", 
        "prompt": "A stylized hand-drawn graphic illustration of a charismatic male stage magician in a checkered vest and cape, holding a floating glowing playing card, surrounded by gold sparkles, no weapons. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited yellow, dark red, and black color palette. Edgy character design, sharp eyes. Background features a large graphic yellow circle and spotlights. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "hunter", 
        "jp": "ハンター", 
        "en": "Hunter", 
        "prompt": "A stylized hand-drawn graphic illustration of a rugged veteran tracker with a green hood, hiding in dense forest foliage, holding a wooden walking staff, alert look, no weapons. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited dark forest green, brown, and black color palette. Edgy character design, sharp eyes. Background features a glowing green circular moon. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "tough_guy", 
        "jp": "タフガイ", 
        "en": "Tough guy", 
        "prompt": "A stylized hand-drawn graphic illustration of a muscular, red-haired blacksmith holding a massive metal hammer over a hot glowing anvil, sparks flying. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited crimson, black, and orange color palette. Edgy character design, sharp eyes. Background features silhouette chimneys of an industrial forge. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    
    # Werewolf Team
    {
        "id": "spy", 
        "jp": "スパイ", 
        "en": "Spy", 
        "prompt": "A stylized hand-drawn graphic illustration of a sleek female spy in a dark leather trench coat, crouching dynamically on a steel girder looking down, holding a small lockpick. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited deep indigo, purple, and crimson color palette. Edgy character design, sharp eyes. Background features a large graphic yellow moon. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "betrayal_twin", 
        "jp": "裏切りの共有者", 
        "en": "Betrayal twin", 
        "prompt": "A stylized hand-drawn graphic illustration of twin gothic lolita twin girls standing back-to-back, one holding a glowing antique key, the other holding a small hand-mirror, no guns or chains. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited hot pink, black, and white color palette. Edgy character design, sharp eyes. Background features a large graphical circular pink moon. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "werewolf", 
        "jp": "人狼", 
        "en": "Werewolf", 
        "prompt": "A stylized hand-drawn graphic illustration of a ferocious, muscular werewolf wearing a torn leather jacket and studded belt, crouching on top of broken concrete ruins, snarling. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited blood red, charcoal black, and white color palette. Edgy character design, sharp eyes. Background features a massive graphical round red moon. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "traitor", 
        "jp": "内通者", 
        "en": "Traitor", 
        "prompt": "A stylized hand-drawn graphic illustration of a mysterious man in a wide-brimmed black fedora hat and long trench coat, leaning on a stone wall, writing in a small notebook while smoking. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited warm amber, black, and crimson color palette. Edgy character design, sharp eyes. Background features a large graphical glowing orange moon. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "betrayer", 
        "jp": "裏切り者", 
        "en": "Betrayer", 
        "prompt": "A stylized hand-drawn graphic illustration of a shady man in a dark trench coat leaning on a brick wall in a dark alleyway, holding a handful of gold coins and smiling slyly. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited yellow-green, purple, and black color palette. Edgy character design, sharp eyes. Background features a large yellow moon. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "werewolf_child", 
        "jp": "人狼の子ども", 
        "en": "Werewolf's child", 
        "prompt": "A stylized hand-drawn graphic illustration of a playful young wolf pup running forward happily, wearing a black shirt with a yellow lightning bolt symbol. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited bright red, black, and white color palette. Edgy character design, sharp eyes. Background features a giant yellow graphic moon and wooden fence silhouettes. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    
    # Third Party
    {
        "id": "android", 
        "jp": "アンドロイド", 
        "en": "Android", 
        "prompt": "A stylized hand-drawn graphic illustration of a futuristic female android robot, green glowing circuitry patterns on her sleek metallic body, standing against a round holographic interface, no wires or electric sparks. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited teal, gray, and bright neon blue color palette. Edgy character design, sharp eyes. Background features a large circular light blue graphic orb. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "lone_wolf", 
        "jp": "一匹狼", 
        "en": "Lone wolf", 
        "prompt": "A stylized hand-drawn graphic illustration of a lone wolf character in a dark hooded vest, standing on a high building edge, holding a silver theater comedy mask, no bones or skulls. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited dark slate blue, black, and pale yellow color palette. Edgy character design, sharp eyes. Background features a giant full moon. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "god", 
        "jp": "神様", 
        "en": "God", 
        "prompt": "A stylized hand-drawn graphic illustration of a celestial golden deity floating in a meditative pose in front of a giant sun wheel graphic, surrounded by floating energy orbs, standard anatomy. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited gold, black, and deep purple color palette. Edgy character design, sharp eyes. Background features a huge graphical gold halo, geometric pillars. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "lovers", 
        "jp": "恋人", 
        "en": "Lovers", 
        "prompt": "A stylized hand-drawn graphic illustration of a stylish young man and woman leaning against each other passionately. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited crimson red, pink, and black color palette. Edgy character design, sharp eyes. Background features a giant graphic outline of a cracked heart. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "mysterious_fox", 
        "jp": "妖狐", 
        "en": "Mysterious fox", 
        "prompt": "A stylized hand-drawn graphic illustration of a seductive female fox spirit with multiple fluffy tails, dressed in a black gothic dress, standing near a ruined iron fence. Heavy ink-brush lineart with pressure variations, pop art screenprint style. Solid flat colors, limited pink, black, and white color palette. Edgy character design, sharp eyes. Background features a large pink graphic moon. Absolutely no smooth digital gradients, no 3D render, not anime, not realistic. Aspect ratio 9:16."
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
    print(f"Submitting task for {role['jp']} ({role['en']})...")
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
    # Forcefully clear old outputs to ensure 100% style consistency across ALL 24 cards
    print("Clearing old card directories to restart fresh...")
    if os.path.exists(RAW_DIR):
        shutil.rmtree(RAW_DIR)
    if os.path.exists(OUT_DIR):
        shutil.rmtree(OUT_DIR)
    os.makedirs(RAW_DIR, exist_ok=True)
    os.makedirs(OUT_DIR, exist_ok=True)

    # 1. Submit all tasks sequentially with a delay to avoid rate limits
    task_map = {}
    for role in roles:
        role_id, task_id = submit_task(role)
        if task_id:
            task_map[role_id] = task_id
        time.sleep(2.0) # Rate limiting delay increased to 2.0s
                
    print("\nAll tasks submitted. Starting status check loop...")
    print(f"Pending tasks: {len(task_map)}")
    
    # 2. Poll tasks
    completed = {}
    failed = []
    
    start_time = time.time()
    timeout = 1200 # 20 minutes
    
    while len(completed) + len(failed) < len(task_map):
        if time.time() - start_time > timeout:
            print("Timeout reached!")
            break
            
        time.sleep(10)
        
        for role_id, task_id in task_map.items():
            if role_id in completed or role_id in failed:
                continue
                
            status, url = check_task_status(task_id)
            print(f"Role {role_id} status: {status}")
            
            if status == "success":
                if url:
                    # Download
                    role_info = next(r for r in roles if r["id"] == role_id)
                    save_path = os.path.join(RAW_DIR, f"{role_id}.png")
                    print(f"Task {role_id} succeeded. Downloading...")
                    if download_image(url, save_path):
                        completed[role_id] = save_path
                        print(f"Successfully saved {role_id} to {save_path}")
                        
                        # Generate labeled card
                        out_path = os.path.join(OUT_DIR, f"{role_id}.png")
                        overlay_card_labels(save_path, out_path, role_info["jp"], role_info["en"])
                    else:
                        print(f"Failed to download image for {role_id}")
                        failed.append(role_id)
                else:
                    print(f"Task {role_id} succeeded but no URL found.")
                    failed.append(role_id)
            elif status in ["fail", "error"]:
                print(f"Task {role_id} failed on KIE.AI.")
                failed.append(role_id)
                
        print(f"Total Progress: {len(completed)} completed, {len(failed)} failed out of {len(task_map)}")
        
    print("\n--- Generation session finished ---")
    print(f"Successfully generated: {len(completed)}")
    print(f"Failed: {len(failed)}")

if __name__ == "__main__":
    main()
