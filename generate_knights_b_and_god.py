import os
import sys
import time
import requests
import json
import math
from PIL import Image, ImageFilter

API_KEY = "f42bc196113ea943377f64713e5aebf2"
API_URL = "https://api.kie.ai/api/v1"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

BG_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/backgrounds-72"
CHAR_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-transparent-72"

os.makedirs(BG_DIR, exist_ok=True)
os.makedirs(CHAR_DIR, exist_ok=True)

# Define tasks to submit
tasks = [
    # 1. Knights B character (Solid yellow background for chroma key extraction)
    {
        "id": "knights_b_char",
        "type": "char",
        "bg_color": (255, 235, 59), # Bright Yellow
        "prompt": (
            "A stylized hand-drawn high-fashion graphic art of three valiant medieval knights standing side-by-side with different equipment and unique poses. "
            "The left knight holds a massive broadsword, the center knight holds a heavy metal shield and a longsword, and the right knight holds a medieval crossbow. "
            "Posing in a stylized thin posture, featuring a fully covered normal flesh and skin body (no exposed bones, no skeletons) but with hyper-slender, elongated limbs. "
            "Exaggerated G-pen ink strokes with dynamic colored outlines. The characters are colored in highly desaturated steel gray and brown tones. "
            "Set against a solid bright yellow background. Clear background, full screen bleed. Aspect ratio 9:16."
        )
    },
    # 2. New God character (Solid cyan background for chroma key extraction)
    {
        "id": "god_char",
        "type": "char",
        "bg_color": (0, 188, 212), # Cyan
        "prompt": (
            "A stylized hand-drawn high-fashion graphic art of a majestic heavenly god wearing a flowing golden robe with detailed engraving ornaments. "
            "Posing in a stylized thin posture, featuring a fully covered normal flesh and skin body (no exposed bones, no skeletons) but with hyper-slender, elongated limbs. "
            "Exaggerated G-pen ink strokes. The character is colored in highly desaturated golden-brown and skin tones. "
            "Set against a solid bright cyan background. Clear background, full screen bleed. Aspect ratio 9:16."
        )
    },
    # 3. Darker God background (No characters)
    {
        "id": "god_bg",
        "type": "bg",
        "prompt": (
            "A highly detailed, intricate hand-drawn G-pen style engraving background. "
            "Colored entirely in a monochromatic color palette of dark golden brown (with only very subtle shifts in value: deep dark chocolate bronze shadows and slightly lighter golden highlights). "
            "It features radiant sun rays breaking through soft heavy dark clouds. "
            "Flat lighting, clean graphic art style. Absolutely no human figures, no people, no characters, clear background scene ONLY. "
            "Full screen bleed, no borders, no cards. Aspect ratio 9:16."
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

def extract_chroma_key(raw_img_path, dst_path, bg_color):
    """Generate transparent PNG from solid color background."""
    img = Image.open(raw_img_path)
    if img.mode != 'RGB':
        img = img.convert('RGB')
    width, height = img.size
    
    rgba_img = Image.new('RGBA', (width, height), (0, 0, 0, 0))
    rgba_data = rgba_img.load()
    img_data = img.load()
    
    bg_r, bg_g, bg_b = bg_color
    
    for y in range(height):
        for x in range(width):
            r, g, b = img_data[x, y]
            dist = math.sqrt((r - bg_r)**2 + (g - bg_g)**2 + (b - bg_b)**2)
            
            if dist < 22:
                alpha = 0
            elif dist > 45:
                alpha = 255
            else:
                alpha = int((dist - 22) / (45 - 22) * 255)
                
            rgba_data[x, y] = (r, g, b, alpha)
            
    r_ch, g_ch, b_ch, a_ch = rgba_img.split()
    a_ch = a_ch.filter(ImageFilter.GaussianBlur(0.8))
    rgba_img = Image.merge('RGBA', (r_ch, g_ch, b_ch, a_ch))
    
    # Save transparent PNG
    rgba_img.save(dst_path, "PNG")
    print(f"  Extracted transparent PNG to {dst_path}")

def main():
    print("Submitting new tasks for Knights B and God updates...")
    
    task_map = {}
    for idx, t in enumerate(tasks):
        print(f"Submitting [{idx+1}/3] {t['id']} task...")
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
                    print(f"  Submitted {t['id']}: Task ID = {task_id}")
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
                "type": t["type"],
                "bg_color": t.get("bg_color")
            }
        time.sleep(2.5)
        
    print(f"\nAll tasks submitted. Polling for {len(task_map)} tasks...")
    
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
                    print(f"Task {r_id} status: {status}")
                    
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
                            temp_raw = f"/tmp/{r_id}_raw.png"
                            print(f"  Downloading {r_id}...")
                            img_data = requests.get(url, timeout=30).content
                            with open(temp_raw, 'wb') as f:
                                f.write(img_data)
                                
                            if info["type"] == "char":
                                # Extract transparent PNG
                                if r_id == "knights_b_char":
                                    dst_name = "knights_b_ver_a.png"
                                else:
                                    dst_name = "god_ver_a.png"
                                out_path = os.path.join(CHAR_DIR, dst_name)
                                extract_chroma_key(temp_raw, out_path, info["bg_color"])
                            else:
                                # Save background
                                out_path = os.path.join(BG_DIR, "god_bg.png")
                                shutil.copy2(temp_raw, out_path)
                                print(f"  Saved background to {out_path}")
                                
                            completed[r_id] = out_path
                        else:
                            print(f"  No URL for {r_id}")
                            failed.append(r_id)
                    elif status in ["fail", "error"]:
                        print(f"  Failed on KIE.AI for {r_id}")
                        failed.append(r_id)
            except Exception as e:
                print(f"  Polling error for {r_id}: {e}")
                
        print(f"Progress: {len(completed)} completed, {len(failed)} failed out of {len(task_map)}")

    print("\n--- Generation and Extraction Finished ---")

if __name__ == "__main__":
    main()
