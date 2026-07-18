import requests
import json

API_KEY = "f42bc196113ea943377f64713e5aebf2"
API_URL = "https://api.kie.ai/api/v1"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

candidates = [
    "flux-2/pro-fill",
    "flux-1.1-pro/fill",
    "flux-1.1/pro-fill",
    "flux/fill",
    "flux-pro/fill",
    "flux-pro/inpainting",
    "flux-2/fill",
    "flux-2/inpainting",
    "recraft-v3/fill",
    "recraft-v3/inpainting",
    "recraft-v3/image-to-image",
    "recraft-v3/edit",
    "flux-2/pro-text-to-image" # This is text-to-image, just to verify 200/422 status behavior on standard payload
]

def test():
    image_url = "https://raw.githubusercontent.com/takaoumehara/werewolf/main/raw-illustrations-transparent-72/werewolf_ver_a.png"
    mask_url = "https://raw.githubusercontent.com/takaoumehara/werewolf/main/werewolf_mask.png"
    
    for model in candidates:
        payload = {
            "model": model,
            "input": {
                "image": image_url,
                "mask": mask_url,
                "prompt": "change wolf snarling face",
                "aspect_ratio": "9:16"
            }
        }
        try:
            r = requests.post(f"{API_URL}/jobs/createTask", json=payload, headers=HEADERS, timeout=10)
            res = r.json()
            code = res.get("code")
            msg = res.get("msg")
            print(f"Model: {model} -> Code: {code}, Msg: {msg}")
        except Exception as e:
            print(f"Error on {model}: {e}")

if __name__ == "__main__":
    test()
