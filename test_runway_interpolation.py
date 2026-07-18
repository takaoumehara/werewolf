import requests
import json

API_KEY = "f42bc196113ea943377f64713e5aebf2"
API_URL = "https://api.kie.ai/api/v1"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# We will try different keys for Runway start/end image interpolation
payloads = [
    # 1. image + image_tail
    {
        "prompt": "spooky werewolf face snarling morphing animation, G-pen engraving style",
        "image": "https://raw.githubusercontent.com/takaoumehara/werewolf/main/raw-illustrations-transparent-72/werewolf_ver_a.png",
        "image_tail": "https://raw.githubusercontent.com/takaoumehara/werewolf/main/raw-illustrations-transparent-72/werewolf_ver_b.png",
        "aspect_ratio": "9:16",
        "duration": 5,
        "quality": "720p"
    },
    # 2. image + end_image
    {
        "prompt": "spooky werewolf face snarling morphing animation, G-pen engraving style",
        "image": "https://raw.githubusercontent.com/takaoumehara/werewolf/main/raw-illustrations-transparent-72/werewolf_ver_a.png",
        "end_image": "https://raw.githubusercontent.com/takaoumehara/werewolf/main/raw-illustrations-transparent-72/werewolf_ver_b.png",
        "aspect_ratio": "9:16",
        "duration": 5,
        "quality": "720p"
    },
    # 3. start_image_url + end_image_url
    {
        "prompt": "spooky werewolf face snarling morphing animation, G-pen engraving style",
        "start_image_url": "https://raw.githubusercontent.com/takaoumehara/werewolf/main/raw-illustrations-transparent-72/werewolf_ver_a.png",
        "end_image_url": "https://raw.githubusercontent.com/takaoumehara/werewolf/main/raw-illustrations-transparent-72/werewolf_ver_b.png",
        "aspect_ratio": "9:16",
        "duration": 5,
        "quality": "720p"
    }
]

def test():
    url = f"{API_URL}/runway/generate"
    for idx, payload in enumerate(payloads):
        try:
            r = requests.post(url, json=payload, headers=HEADERS, timeout=15)
            res = r.json()
            code = res.get("code")
            msg = res.get("msg")
            print(f"Try {idx+1} -> Code: {code}, Msg: {msg}")
            if code == 200:
                print("!!! SUCCESS !!! Task submitted:", res)
                break
        except Exception as e:
            print(f"Error on Try {idx+1}: {e}")

if __name__ == "__main__":
    test()
