import requests
import json
import time

API_KEY = "f42bc196113ea943377f64713e5aebf2"
API_URL = "https://api.kie.ai/api/v1"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# Inpainting models to try
models = [
    "flux-2/fill",
    "flux-1.1-pro/inpainting",
    "recraft-v3/inpainting"
]

def run_inpaint():
    image_url = "https://raw.githubusercontent.com/takaoumehara/werewolf/main/raw-illustrations-transparent-72/werewolf_ver_a.png"
    mask_url = "https://raw.githubusercontent.com/takaoumehara/werewolf/main/werewolf_mask.png"
    prompt = (
        "A dark gothic G-pen woodcut engraving style of a snarling werewolf's head. "
        "Its ears are twitched flat backward in a defensive and aggressive posture. "
        "Its mouth is slightly open, showing snarling sharp white fangs, with faint red energy glows and breath steam drifting from the fangs. "
        "Highly detailed ink hatch lines, matching the surrounding style perfectly."
    )
    
    task_id = None
    successful_model = None
    
    for model in models:
        payload = {
            "model": model,
            "input": {
                "image": image_url,
                "mask": mask_url,
                "prompt": prompt,
                "aspect_ratio": "9:16"
            }
        }
        
        try:
            print(f"Testing inpaint model: {model}...")
            r = requests.post(f"{API_URL}/jobs/createTask", json=payload, headers=HEADERS, timeout=15)
            res = r.json()
            code = res.get("code")
            msg = res.get("msg")
            print(f"  Response Code: {code}, Msg: {msg}")
            
            if code == 200:
                task_id = res.get("data", {}).get("taskId")
                successful_model = model
                print(f"!!! SUCCESS !!! Task submitted with model: {model}, Task ID: {task_id}")
                break
        except Exception as e:
            print(f"  Error on {model}: {e}")
            
    if not task_id:
        print("Failed to submit inpainting task to any model.")
        return
        
    # Poll task
    print(f"\nPolling task {task_id} for {successful_model}...")
    start_time = time.time()
    while time.time() - start_time < 300:
        time.sleep(15)
        try:
            r = requests.get(f"{API_URL}/jobs/recordInfo?taskId={task_id}", headers=HEADERS, timeout=10)
            res = r.json()
            if r.status_code == 200 and res.get("code") == 200:
                data = res.get("data", {})
                state = data.get("state")
                print(f"  State: {state}")
                if state == "success":
                    # KIE.ai usually puts output in task response fields
                    # Let's inspect where the image URL is
                    print("  Task Succeeded! Full response:")
                    print(json.dumps(res, indent=2, ensure_ascii=False))
                    break
                elif state in ["fail", "error"]:
                    print(f"  Task failed: {data.get('failMsg')}")
                    break
            else:
                print("  Failed to check status:", res)
        except Exception as e:
            print("  Error polling:", e)

if __name__ == "__main__":
    run_inpaint()
