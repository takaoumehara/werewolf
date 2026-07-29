import os
import time
import requests
import json
import shutil

API_KEY = os.environ["KIE_API_KEY"]
API_URL = "https://api.kie.ai/api/v1"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

LOGO_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/logos"
os.makedirs(LOGO_DIR, exist_ok=True)

# 8 Logo Directions
logo_definitions = [
    {
        "index": 1,
        "title": "Heraldic Shield Crest",
        "prompt": (
            "A dark gothic heraldic crest emblem for a medieval werewolf game. "
            "Featuring a stylized silver wolf head snarling inside a classic heraldic shield decorated with elegant filigree engravings, old silver and vintage gold trim. "
            "Clean graphic logo design, centered, high-contrast, G-pen style woodcut engraving details. "
            "Set against a solid dark gray background. Isolated design, no text."
        )
    },
    {
        "index": 2,
        "title": "Geometric Crescent Fangs",
        "prompt": (
            "A minimalist modern geometric logo representing a werewolf. "
            "Abstractly combining a crescent moon shape and sharp werewolf fangs into a clean circular icon. "
            "Sharp vector lines, flat graphic design, desaturated steel gray and crimson colors. "
            "Set against a solid dark gray background. Isolated design, no text."
        )
    },
    {
        "index": 3,
        "title": "Antique Ink Snarl",
        "prompt": (
            "An antique G-pen style engraving logo of a snarling werewolf. "
            "Hand-drawn scratch art with high-contrast black ink textures, dramatic hatching, vintage woodcut style. "
            "Rustic and wild feel. "
            "Set against a solid dark gray background. Isolated design, no text."
        )
    },
    {
        "index": 4,
        "title": "Mystical Rune Monogram",
        "prompt": (
            "A mystical monogram crest logo for a werewolf game. "
            "Intricately combining ancient Nordic rune symbols with a wolf claw scratch shape. "
            "Glowing faint silver-blue runes, dark magic aesthetic, vintage engraving borders. "
            "Set against a solid dark gray background. Isolated design, no text."
        )
    },
    {
        "index": 5,
        "title": "Gothic Letter Mark",
        "prompt": (
            "A gothic decorative letter mark logo. "
            "The capital letter 'W' styled with a roaring wolf silhouette incorporated into its curves, with elegant engraving details, ancient royal silver metal texture. "
            "Dark fantasy vibe. "
            "Set against a solid dark gray background. Isolated design, no text."
        )
    },
    {
        "index": 6,
        "title": "Double Exposure Forest Moon",
        "prompt": (
            "A graphic double exposure silhouette logo of a howling wolf. "
            "Inside the wolf's body is a detailed silhouette of a dark gothic pine forest at night, set against a dark textured full moon. "
            "Flat clean vector shape with organic textures, mystical mood. "
            "Set against a solid dark gray background. Isolated design, no text."
        )
    },
    {
        "index": 7,
        "title": "Twin Wolves & Iron Key",
        "prompt": (
            "A royal heraldic emblem featuring twin wolves facing each other. "
            "An ancient iron key sits vertically between them, Renaissance engraving style, antique bronze and steel colors. "
            "Fine linework, symmetrical emblem design. "
            "Set against a solid dark gray background. Isolated design, no text."
        )
    },
    {
        "index": 8,
        "title": "Chained Wolf Skull",
        "prompt": (
            "A dark fantasy gothic horror logo. "
            "Featuring a silver wolf skull surrounded by medieval iron chains. "
            "Vintage woodblock engraving texture, desaturated slate and bronze tones, high contrast. "
            "Set against a solid dark gray background. Isolated design, no text."
        )
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
    print("Generating 8 werewolf game logo designs...")
    
    task_map = {}
    for idx, t in enumerate(logo_definitions):
        print(f"Submitting [{idx+1}/8] Logo '{t['title']}'...")
        payload = {
            "model": "flux-2/pro-text-to-image",
            "input": {
                "prompt": t["prompt"],
                "aspect_ratio": "1:1", # Logos are square 1:1
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
                    print(f"  Submitted {t['title']}: Task ID = {task_id}")
                    break
                else:
                    print(f"  Error (try {try_idx+1}/3): {res_json}")
                    time.sleep(3)
            except Exception as e:
                print(f"  Exception (try {try_idx+1}/3): {e}")
                time.sleep(3)
                
        if task_id:
            task_map[t["index"]] = {
                "taskId": task_id,
                "title": t["title"]
            }
        time.sleep(2.5)
        
    print(f"\nAll tasks submitted. Polling for {len(task_map)} logo tasks...")
    
    completed = {}
    failed = []
    start_time = time.time()
    timeout = 900
    
    while len(completed) + len(failed) < len(task_map):
        if time.time() - start_time > timeout:
            print("Session timeout reached!")
            break
            
        time.sleep(15)
        
        for idx, info in task_map.items():
            if idx in completed or idx in failed:
                continue
                
            task_id = info["taskId"]
            title = info["title"]
            try:
                r = requests.get(f"{API_URL}/jobs/recordInfo?taskId={task_id}", headers=HEADERS, timeout=15)
                res_json = r.json()
                if r.status_code == 200 and res_json.get("code") == 200:
                    data = res_json.get("data", {})
                    status = data.get("state")
                    print(f"Logo '{title}' status: {status}")
                    
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
                            out_path = os.path.join(LOGO_DIR, f"logo_{idx}.png")
                            print(f"  Downloading logo_{idx} ({title})...")
                            img_data = requests.get(url, timeout=30).content
                            with open(out_path, 'wb') as f:
                                f.write(img_data)
                            completed[idx] = out_path
                            print(f"  Successfully finished logo_{idx}.")
                        else:
                            print(f"  No URL for logo_{idx}")
                            failed.append(idx)
                    elif status in ["fail", "error"]:
                        print(f"  Failed on KIE.AI for logo_{idx}")
                        failed.append(idx)
            except Exception as e:
                print(f"  Polling error for logo_{idx}: {e}")
                
        print(f"Progress: {len(completed)} completed, {len(failed)} failed out of {len(task_map)}")

    print("\n--- Logos Generation Finished ---")

if __name__ == "__main__":
    main()
