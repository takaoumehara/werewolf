import requests
import json
import time

API_KEY = "f42bc196113ea943377f64713e5aebf2"
API_URL = "https://api.kie.ai/api/v1"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def test_inpaint_via_t2i():
    # Pass 'image', 'mask', and 'prompt' to flux-2/pro-text-to-image to see if it does inpainting
    payload = {
        "model": "flux-2/pro-text-to-image",
        "input": {
            "image": "https://raw.githubusercontent.com/takaoumehara/werewolf/main/raw-illustrations-transparent-72/werewolf_ver_a.png",
            "mask": "https://raw.githubusercontent.com/takaoumehara/werewolf/main/werewolf_mask.png",
            "prompt": "spooky werewolf snarling, ears flat backward, mouth slightly open, G-pen style woodcut engraving",
            "aspect_ratio": "9:16",
            "resolution": "1K"
        }
    }
    
    try:
        r = requests.post(f"{API_URL}/jobs/createTask", json=payload, headers=HEADERS, timeout=15)
        print("Response JSON:")
        print(json.dumps(r.json(), indent=2, ensure_ascii=False))
        
        task_id = r.json().get("data", {}).get("taskId")
        if task_id:
            print("\nPolling status...")
            for _ in range(15):
                time.sleep(10)
                status_res = requests.get(f"{API_URL}/jobs/recordInfo?taskId={task_id}", headers=HEADERS).json()
                state = status_res.get("data", {}).get("state")
                print(f"  State: {state}")
                if state == "success":
                    print("  Success! Result:")
                    print(json.dumps(status_res, indent=2, ensure_ascii=False))
                    break
                elif state in ["fail", "error"]:
                    print("  Failed:", status_res.get("data", {}).get("failMsg"))
                    break
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_inpaint_via_t2i()
