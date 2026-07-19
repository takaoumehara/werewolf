import requests
import json

API_KEY = "f42bc196113ea943377f64713e5aebf2"
API_URL = "https://api.kie.ai/api/v1"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

def test_multi_prompts():
    image_a = "https://raw.githubusercontent.com/takaoumehara/werewolf/main/raw-illustrations-transparent-72/werewolf_ver_a.png"
    image_b = "https://raw.githubusercontent.com/takaoumehara/werewolf/main/raw-illustrations-transparent-72/werewolf_ver_b.png"
    
    payloads = [
        # Try 1: multi_prompt with image
        {
            "model": "kling-3.0/video",
            "input": {
                "prompt": "spooky werewolf face snarling, G-pen style woodcut engraving",
                "image": image_a,
                "aspect_ratio": "9:16",
                "duration": 5,
                "multi_shots": True,
                "multi_prompt": [
                    {
                        "prompt": "wolf ears start to twitch back, woodcut engraving",
                        "image": image_b
                    }
                ]
            }
        },
        # Try 2: using "prompts" instead of "multi_prompt"
        {
            "model": "kling-3.0/video",
            "input": {
                "prompt": "spooky werewolf face snarling, G-pen style woodcut engraving",
                "image": image_a,
                "aspect_ratio": "9:16",
                "duration": 5,
                "multi_shots": True,
                "prompts": [
                    {
                        "prompt": "wolf ears start to twitch back, woodcut engraving",
                        "image": image_b
                    }
                ]
            }
        },
        # Try 3: using "shots" list
        {
            "model": "kling-3.0/video",
            "input": {
                "prompt": "spooky werewolf face snarling, G-pen style woodcut engraving",
                "image": image_a,
                "aspect_ratio": "9:16",
                "duration": 5,
                "multi_shots": True,
                "shots": [
                    {
                        "prompt": "wolf ears start to twitch back, woodcut engraving",
                        "image": image_b
                    }
                ]
            }
        },
        # Try 4: using "multi_prompts" (plural)
        {
            "model": "kling-3.0/video",
            "input": {
                "prompt": "spooky werewolf face snarling, G-pen style woodcut engraving",
                "image": image_a,
                "aspect_ratio": "9:16",
                "duration": 5,
                "multi_shots": True,
                "multi_prompts": [
                    {
                        "prompt": "wolf ears start to twitch back, woodcut engraving",
                        "image": image_b
                    }
                ]
            }
        }
    ]
    
    for idx, payload in enumerate(payloads):
        try:
            r = requests.post(f"{API_URL}/jobs/createTask", json=payload, headers=HEADERS, timeout=15)
            res = r.json()
            print(f"Try {idx+1} -> Code: {res.get('code')}, Msg: {res.get('msg')}")
            if res.get("code") == 200:
                print("!!! SUCCESS !!!", res)
                break
        except Exception as e:
            print(f"Error on Try {idx+1}: {e}")

if __name__ == "__main__":
    test_multi_prompts()
