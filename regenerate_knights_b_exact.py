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

CHAR_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-transparent-72"
temp_raw = "/tmp/knights_b_exact_raw.png"
dst_path = os.path.join(CHAR_DIR, "knights_b_ver_a.png")

bg_color = (255, 235, 59) # Yellow background for extraction

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
    
    rgba_img.save(dst_path, "PNG")
    print(f"  Extracted transparent PNG to {dst_path}")

def main():
    print("Regenerating Knights B character with exact matching style (thigh-up crop, desaturated steel armor, G-pen lines, orange highlights)...")
    
    prompt = (
        "A stylized hand-drawn high-fashion graphic art of three valiant medieval knights standing side-by-side. "
        "Half-body portrait, showing from the thighs up (no full legs, no feet, exactly matching the crop level of Knights A). "
        "The left knight holds a massive broadsword resting on his shoulder, the center knight holds a heavy metal shield and a drawn longsword, "
        "and the right knight holds a medieval crossbow with detailed arrow bolts. "
        "Posing in a stylized thin posture, featuring a fully covered normal flesh and skin body (no exposed bones, no skeletons) but with hyper-slender, elongated limbs. "
        "Exaggerated G-pen ink strokes with dynamic orange and rust-colored ambient backlight reflecting on the armor contours. "
        "The characters are colored in highly desaturated steel gray and brown tones, exactly matching the high-contrast G-pen line art style of Knights A. "
        "Set against a solid bright yellow background. Clear background, full screen bleed. Aspect ratio 9:16."
    )
    
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
                print(f"Submitted knights_b_exact: Task ID = {task_id}")
                break
            else:
                print(f"Error (try {try_idx+1}/3): {res_json}")
                time.sleep(3)
        except Exception as e:
            print(f"Exception (try {try_idx+1}/3): {e}")
            time.sleep(3)
            
    if not task_id:
        print("Failed to submit task!")
        return
        
    print("\nPolling knights_b_exact status...")
    start_time = time.time()
    timeout = 300
    
    while True:
        if time.time() - start_time > timeout:
            print("Session timeout reached!")
            break
            
        time.sleep(15)
        
        try:
            r = requests.get(f"{API_URL}/jobs/recordInfo?taskId={task_id}", headers=HEADERS, timeout=15)
            res_json = r.json()
            if r.status_code == 200 and res_json.get("code") == 200:
                data = res_json.get("data", {})
                status = data.get("state")
                print(f"Task knights_b_exact status: {status}")
                
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
                        print("  Downloading raw image...")
                        img_data = requests.get(url, timeout=30).content
                        with open(temp_raw, 'wb') as f:
                            f.write(img_data)
                        extract_chroma_key(temp_raw, dst_path, bg_color)
                        print("  Successfully finished and processed Knights B exact.")
                        break
                    else:
                        print("  No URL found.")
                        break
                elif status in ["fail", "error"]:
                    print("  Task failed.")
                    break
        except Exception as e:
            print(f"  Polling error: {e}")

if __name__ == "__main__":
    main()
