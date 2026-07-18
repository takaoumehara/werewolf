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

RAW_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations"
OUT_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards"

# Optimised mild prompts that avoid triggering safety/NSFW filters (avoiding weapons, skulls, traps, and aggressive poses)
retry_roles = [
    {
        "id": "knights", 
        "jp": "騎士団", 
        "en": "Knights", 
        "prompt": "Stylized graphic poster illustration in Baron Ueda style of three noble guardians standing side-by-side in polished silver armor, holding glowing oval shields in a protective stance, no weapons. Bold black outlines with pressure variation, pop art vector-like strokes. High contrast flat colors, limited dark blue and silver color palette. Edgy character design, sharp intense eyes. Background features a large graphical circular blue moon. No smooth airbrush gradients, no 3D rendering, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "double", 
        "jp": "影武者", 
        "en": "Double", 
        "prompt": "Stylized graphic poster illustration in Baron Ueda style of a mysterious young man wearing a dark violet coat, creating multiple glowing purple visual illusions of himself in the background. Bold black outlines with pressure variation, pop art vector-like strokes. High contrast flat colors, limited gray, black, and light purple color palette. Edgy character design, sharp intense eyes. Background features a large graphical glowing circular purple moon. No smooth airbrush gradients, no 3D rendering, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "necromancer", 
        "jp": "霊媒師", 
        "en": "Necromancer", 
        "prompt": "Stylized graphic poster illustration in Baron Ueda style of a mystical female shaman in a starry purple gown, raising her hands to summon glowing magical wisps of pink and purple light, no skeletons or bones. Bold black outlines with pressure variation, pop art vector-like strokes. High contrast flat colors, limited violet, black, and hot pink color palette. Edgy character design, sharp intense eyes. Background has dark forest tree silhouettes and a full pink moon. No smooth airbrush gradients, no 3D rendering, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "dictator", 
        "jp": "独裁者", 
        "en": "Dictator", 
        "prompt": "Stylized graphic poster illustration in Baron Ueda style of a charismatic visionary leader in a formal dark blue dress uniform with gold embroidery, standing tall on a high balcony in a commanding posture, holding a golden scepter, no weapons. Bold black outlines with pressure variation, pop art vector-like strokes. High contrast flat colors, limited navy blue, white, and gold color palette. Edgy character design, sharp intense eyes. Background features a giant white crescent moon and spotlight beam silhouettes. No smooth airbrush gradients, no 3D rendering, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "trapper", 
        "jp": "罠師", 
        "en": "Trapper", 
        "prompt": "Stylized graphic poster illustration in Baron Ueda style of a stealthy forest ranger wearing a green mask, crouching on a thick tree branch, holding a small glowing mechanical navigation device. Bold black outlines with pressure variation, pop art vector-like strokes. High contrast flat colors, limited olive green, black, and bright yellow color palette. Edgy character design, sharp intense eyes. Background features a large graphical round yellow moon and dark forest canopy. No smooth airbrush gradients, no 3D rendering, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "bodyguard", 
        "jp": "ボディガード", 
        "en": "Bodyguard", 
        "prompt": "Stylized graphic poster illustration in Baron Ueda style of a muscular bald protector wearing dark leather vest armor, standing firm with a massive round metal shield in front of him, protective stance, no swords or weapons. Bold black outlines with pressure variation, pop art vector-like strokes. High contrast flat colors, limited safety orange, olive green, and black color palette. Edgy character design, sharp intense eyes. Background features a large graphical yellow moon and city wall silhouettes. No smooth airbrush gradients, no 3D rendering, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "magician", 
        "jp": "奇術師", 
        "en": "Magician", 
        "prompt": "Stylized graphic poster illustration in Baron Ueda style of a charismatic male stage magician in a checkered vest and cape, holding a floating glowing playing card, surrounded by gold sparkles, no weapons or daggers. Bold black outlines with pressure variation, pop art vector-like strokes. High contrast flat colors, limited yellow, dark red, and black color palette. Edgy character design, sharp intense eyes. Background features a large graphic yellow circle and spotlights. No smooth airbrush gradients, no 3D rendering, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "hunter", 
        "jp": "ハンター", 
        "en": "Hunter", 
        "prompt": "Stylized graphic poster illustration in Baron Ueda style of a rugged veteran tracker with a green hood, hiding in dense forest foliage, holding a wooden walking staff, alert look, no bows or arrows. Bold black outlines with pressure variation, pop art vector-like strokes. High contrast flat colors, limited dark forest green, brown, and black color palette. Edgy character design, sharp intense eyes. Background features a glowing green circular moon. No smooth airbrush gradients, no 3D rendering, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "betrayal_twin", 
        "jp": "裏切りの共有者", 
        "en": "Betrayal twin", 
        "prompt": "Stylized graphic poster illustration in Baron Ueda style of twin gothic sisters standing back-to-back, one holding a glowing antique key, the other holding a small hand-mirror, no guns or chains. Bold black outlines with pressure variation, pop art vector-like strokes. High contrast flat colors, limited hot pink, black, and white color palette. Edgy character design, sharp intense eyes. Background features a large graphical circular pink moon. No smooth airbrush gradients, no 3D rendering, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "werewolf_child", 
        "jp": "人狼の子ども", 
        "en": "Werewolf's child", 
        "prompt": "Stylized graphic poster illustration in Baron Ueda style of a playful young wolf pup running forward happily, wearing a black shirt with a yellow lightning bolt symbol. Bold black outlines with pressure variation, pop art vector-like strokes. High contrast flat colors, limited bright red, black, and white color palette. Edgy character design, sharp intense eyes. Background features a giant yellow graphic moon and wooden fence silhouettes. No smooth airbrush gradients, no 3D rendering, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "android", 
        "jp": "アンドロイド", 
        "en": "Android", 
        "prompt": "Stylized graphic poster illustration in Baron Ueda style of a futuristic female android robot, green glowing circuitry patterns on her sleek metallic body, standing against a round holographic interface, no wires or electric sparks. Bold black outlines with pressure variation, pop art vector-like strokes. High contrast flat colors, limited teal, gray, and bright neon blue color palette. Edgy character design, sharp intense eyes. Background features a large circular light blue graphic orb. No smooth airbrush gradients, no 3D rendering, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "lone_wolf", 
        "jp": "一匹狼", 
        "en": "Lone wolf", 
        "prompt": "Stylized graphic poster illustration in Baron Ueda style of a lone wolf character in a dark hooded vest, standing on a high building edge, holding a silver theater comedy mask, no bones or skulls. Bold black outlines with pressure variation, pop art vector-like strokes. High contrast flat colors, limited dark slate blue, black, and pale yellow color palette. Edgy character design, sharp intense eyes. Background features a giant full moon and city skyline silhouette. No smooth airbrush gradients, no 3D rendering, not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id": "god", 
        "jp": "神様", 
        "en": "God", 
        "prompt": "Stylized graphic poster illustration in Baron Ueda style of a celestial golden deity floating in a meditative pose in front of a giant sun wheel graphic, surrounded by floating energy orbs, standard anatomy. Bold black outlines with pressure variation, pop art vector-like strokes. High contrast flat colors, limited gold, black, and deep purple color palette. Edgy character design, sharp intense eyes. Background features a huge graphical gold halo, geometric pillars. No smooth airbrush gradients, no 3D rendering, not anime, not realistic. Aspect ratio 9:16."
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
    print(f"Submitting retry task for {role['jp']} ({role['en']})...")
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
    task_map = {}
    
    # Check what roles are already successfully generated
    existing_cards = [f.replace(".png", "") for f in os.listdir(OUT_DIR) if f.endswith(".png")]
    print(f"Already completed roles: {existing_cards}")
    
    # Filter retry list
    target_roles = [r for r in retry_roles if r["id"] not in existing_cards]
    print(f"Roles needing generation/retry: {[r['id'] for r in target_roles]}")
    
    if not target_roles:
        print("All roles are already completed! Nothing to retry.")
        return

    # Submit retry tasks
    for role in target_roles:
        role_id, task_id = submit_task(role)
        if task_id:
            task_map[role_id] = task_id
        time.sleep(1.5) # Rate limit delay
        
    print("\nAll retry tasks submitted. Starting polling loop...")
    
    completed = {}
    failed = []
    start_time = time.time()
    timeout = 600 # 10 minutes
    
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
                    role_info = next(r for r in retry_roles if r["id"] == role_id)
                    save_path = os.path.join(RAW_DIR, f"{role_id}.png")
                    print(f"Task {role_id} succeeded. Downloading...")
                    if download_image(url, save_path):
                        completed[role_id] = save_path
                        print(f"Saved raw image to {save_path}")
                        
                        # Generate labeled card
                        out_path = os.path.join(OUT_DIR, f"{role_id}.png")
                        overlay_card_labels(save_path, out_path, role_info["jp"], role_info["en"])
                    else:
                        print(f"Download failed for {role_id}")
                        failed.append(role_id)
                else:
                    print(f"No URL found for {role_id}")
                    failed.append(role_id)
            elif status in ["fail", "error"]:
                print(f"Task {role_id} failed on KIE.AI side.")
                failed.append(role_id)
                
        print(f"Retry Progress: {len(completed)} completed, {len(failed)} failed out of {len(task_map)}")

    print("\n--- Retry Session Finished ---")
    print(f"Succeeded: {len(completed)}")
    print(f"Failed: {len(failed)}")

if __name__ == "__main__":
    main()
