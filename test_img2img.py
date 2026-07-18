import requests
import json

API_KEY = "f42bc196113ea943377f64713e5aebf2"
API_URL = "https://api.kie.ai/api/v1"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def test_img2img():
    # Test if flux-2/pro-text-to-image accepts 'image' and 'strength' to perform img2img
    payload = {
        "model": "flux-2/pro-text-to-image",
        "input": {
            "prompt": "spooky werewolf snarling, ears flat backward, mouth slightly open, G-pen style woodcut engraving",
            "image": "https://raw.githubusercontent.com/takaoumehara/werewolf/main/raw-illustrations-transparent-72/werewolf_ver_a.png",
            "strength": 0.35, # Low strength to preserve the G-pen style and overall structure
            "aspect_ratio": "9:16",
            "resolution": "1K"
        }
    }
    
    try:
        r = requests.post(f"{API_URL}/jobs/createTask", json=payload, headers=HEADERS, timeout=15)
        print("Response JSON:")
        print(json.dumps(r.json(), indent=2, ensure_ascii=False))
    except Exception as e:
        print("Error:", e)

if __name__ == "__main__":
    test_img2img()
