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

# Specific resolved descriptions for the final 6 failed cards to completely eliminate pose/character contradictions and filters.
final_retries = [
    {
        "id_key": "counselor_ver_a",
        "jp": "カウンセラー A",
        "en": "Counselor A",
        "color": "emerald green",
        "prompt": "A stylized hand-drawn high-fashion graphic art of a sophisticated gentleman with wavy hair wearing a high-collared coat, standing with a highly slender stylized silhouette, back turned to the viewer, exhibiting beautifully elongated artistic fingers and a tilted pelvis. Exaggerated G-pen ink strokes with extreme thick-to-thin pressure variations. No uniform thick black lines; instead, it features dynamic colored outlines that change color based on the local color of the body part. Highly muted desaturated colors against a solid vibrant emerald green background. Full screen bleed, no borders. Absolutely not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id_key": "trapper_ver_c",
        "jp": "罠師 C",
        "en": "Trapper C",
        "color": "mustard yellow",
        "prompt": "A stylized hand-drawn high-fashion graphic art of a stealthy forest ranger wearing a hood and mask, standing tall in a theatrical side-profile pose, shoulders at uneven asymmetrical heights, looking over shoulder with a sharp intense gaze, holding a glowing metallic crystal compass. Exaggerated G-pen ink strokes with extreme thick-to-thin pressure variations. No uniform thick black lines; instead, it features dynamic colored outlines that change color based on the local color of the body part. Highly muted desaturated colors against a solid vibrant mustard yellow background. Full screen bleed, no borders. Absolutely not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id_key": "bodyguard_ver_b",
        "jp": "ボディガード B",
        "en": "Bodyguard B",
        "color": "safety orange",
        "prompt": "A stylized hand-drawn high-fashion graphic art of a noble towering tall guardian in leather vest armor, standing in a highly asymmetrical front pose, with a beautifully tilted head angle, holding a small golden signet shield close to his chest. Exaggerated G-pen ink strokes with extreme thick-to-thin pressure variations. No uniform thick black lines; instead, it features dynamic colored outlines that change color based on the local color of the body part. Highly muted desaturated colors against a solid vibrant safety orange background. Full screen bleed, no borders. Absolutely not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id_key": "magician_ver_b",
        "jp": "奇術師 B",
        "en": "Magician B",
        "color": "purple",
        "prompt": "A stylized hand-drawn high-fashion graphic art of a charismatic stage magician in a checkered vest and cape, standing in a highly asymmetrical front pose, with a beautifully tilted head angle, holding a single glowing playing card close to his chest. Exaggerated G-pen ink strokes with extreme thick-to-thin pressure variations. No uniform thick black lines; instead, it features dynamic colored outlines that change color based on the local color of the body part. Highly muted desaturated colors against a solid vibrant purple background. Full screen bleed, no borders. Absolutely not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id_key": "betrayal_twin_ver_b",
        "jp": "裏切りの共有者 B",
        "en": "Betrayal twin B",
        "color": "fuchsia",
        "prompt": "A stylized hand-drawn high-fashion graphic art of two young sisters wearing dark frilly dresses, standing in a highly asymmetrical front pose, one sister with a beautifully tilted head angle, holding a glowing pocket locket close to her chest. Exaggerated G-pen ink strokes with extreme thick-to-thin pressure variations. No uniform thick black lines; instead, it features dynamic colored outlines that change color based on the local color of the body part. Highly muted desaturated colors against a solid vibrant fuchsia background. Full screen bleed, no borders. Absolutely not anime, not realistic. Aspect ratio 9:16."
    },
    {
        "id_key": "werewolf_child_ver_c",
        "jp": "人狼の子ども C",
        "en": "Werewolf's child C",
        "color": "scarlet red",
        "prompt": "A stylized hand-drawn high-fashion graphic art of a mysterious young boy with cute wolf ears, wearing a black shirt with a yellow lightning symbol, standing tall in a theatrical side-profile pose, shoulders at uneven asymmetrical heights, looking over shoulder with a sharp intense gaze. Exaggerated G-pen ink strokes with extreme thick-to-thin pressure variations. No uniform thick black lines; instead, it features dynamic colored outlines that change color based on the local color of the body part. Highly muted desaturated colors against a solid vibrant scarlet red background. Full screen bleed, no borders. Absolutely not anime, not realistic. Aspect ratio 9:16."
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
    print(f"Starting final retry for the last {len(final_retries)} cards...")
    
    # 1. Submit tasks
    task_map = {}
    for t in final_retries:
        print(f"Submitting final retry task for {t['en']}...")
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
                    print(f"  Submitted {t['id_key']}: Task ID = {task_id}")
                    break
                else:
                    print(f"  Error (try {try_idx+1}/3): {res_json}")
                    time.sleep(3)
            except Exception as e:
                print(f"  Exception (try {try_idx+1}/3): {e}")
                time.sleep(3)
                
        if task_id:
            task_map[t["id_key"]] = {
                "taskId": task_id,
                "jp": t["jp"],
                "en": t["en"]
            }
        time.sleep(2.5)
        
    print(f"\nAll final tasks submitted. Running polling loop for {len(task_map)} tasks...")
    
    completed = {}
    failed = []
    start_time = time.time()
    timeout = 600
    
    while len(completed) + len(failed) < len(task_map):
        if time.time() - start_time > timeout:
            print("Final retry session timeout!")
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
                    print(f"Final Task {id_key} status: {status}")
                    
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
                
        print(f"Final Progress: {len(completed)} completed, {len(failed)} failed out of {len(task_map)}")

    print("\n--- Final Retry Session Finished ---")
    print(f"Successfully Recovered: {len(completed)}")
    print(f"Unrecoverable: {len(failed)}")

if __name__ == "__main__":
    main()
