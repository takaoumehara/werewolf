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

RAW_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/test-twin-raw"
OUT_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/test-twin-variants"

role = {
    "id": "betrayal_twin_ver_a", 
    "jp": "裏切りの共有者 A", 
    "en": "Betrayal twin Ver.A", 
    "prompt": "A stylized hand-drawn high-fashion graphic art of two young sisters wearing beautiful dark frilly dresses, standing back-to-back. High-contrast flat color palette of muted hot pink, black, and white. Every character element and garment features colored outlines drawn in a slightly darker shade of their respective fill color (such as a dark red outline surrounding a pink dress, and a dark brown outline surrounding the skin) with absolutely no black outlines used. Highly exaggerated G-pen stroke variations with extreme thick-to-thin line widths. The character designs exhibit stylized hyper-slender proportions, uneven shoulder heights, and slightly twisted artistic posing to create an avant-garde flavor. Background is a vibrant solid hot pink. Full screen bleed, no borders. Absolutely not anime, not realistic. Aspect ratio 9:16."
}

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
    print(f"Submitting retry task for {role['en']}...")
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
            print(f"Submitted task: ID = {task_id}")
        else:
            print(f"Error submitting: {res_json}")
            return
    except Exception as e:
        print(f"HTTP Exception: {e}")
        return

    print("Polling task status...")
    start_time = time.time()
    timeout = 300
    
    while True:
        if time.time() - start_time > timeout:
            print("Timeout!")
            break
            
        time.sleep(10)
        
        try:
            r = requests.get(f"{API_URL}/jobs/recordInfo?taskId={task_id}", headers=HEADERS, timeout=15)
            r_json = r.json()
            if r.status_code == 200 and r_json.get("code") == 200:
                data = r_json.get("data", {})
                status = data.get("state")
                print(f"Status: {status}")
                
                if status == "success":
                    url = find_image_url(r_json)
                    if not url:
                        result_json_str = data.get("resultJson")
                        if result_json_str:
                            try:
                                result_data = json.loads(result_json_str)
                                urls = result_data.get("resultUrls", [])
                                if urls:
                                    url = urls[0]
                            except Exception:
                                pass
                    
                    if url:
                        save_path = os.path.join(RAW_DIR, f"{role['id']}.png")
                        print("Downloading...")
                        img_data = requests.get(url, timeout=30).content
                        with open(save_path, 'wb') as f:
                            f.write(img_data)
                        
                        out_path = os.path.join(OUT_DIR, f"{role['id']}.png")
                        overlay_card_labels(save_path, out_path, role["jp"], role["en"])
                        print("Success!")
                        break
                    else:
                        print("No URL found.")
                        break
                elif status in ["fail", "error"]:
                    print(f"Failed on KIE: {r_json}")
                    break
        except Exception as e:
            print(f"Polling error: {e}")

if __name__ == "__main__":
    main()
