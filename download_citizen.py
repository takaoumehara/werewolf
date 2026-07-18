import os
import requests
import json
from generate_cards import overlay_card_labels

API_KEY = "f42bc196113ea943377f64713e5aebf2"
API_URL = "https://api.kie.ai/api/v1"
HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

RAW_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/test-raw-illustrations"
OUT_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/test-generated-cards"

role = {
    "id": "citizen", 
    "jp": "市民", 
    "en": "Citizen"
}

task_id = "16e3c58ec9b077fef00395c385fea55e"

def main():
    response = requests.get(f"{API_URL}/jobs/recordInfo?taskId={task_id}", headers=HEADERS)
    res_json = response.json()
    
    data = res_json.get("data", {})
    result_json_str = data.get("resultJson")
    url = None
    if result_json_str:
        result_data = json.loads(result_json_str)
        urls = result_data.get("resultUrls", [])
        if urls:
            url = urls[0]
            
    if url:
        save_path = os.path.join(RAW_DIR, f"{role['id']}.png")
        print(f"Downloading Citizen image from {url}...")
        img_data = requests.get(url, timeout=30).content
        with open(save_path, 'wb') as f:
            f.write(img_data)
            
        out_path = os.path.join(OUT_DIR, f"{role['id']}.png")
        overlay_card_labels(save_path, out_path, role["jp"], role["en"])
        print("Success! Citizen card generated.")
    else:
        print("URL not found in resultJson.")

if __name__ == "__main__":
    main()
