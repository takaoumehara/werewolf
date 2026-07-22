import os
import time
import requests
import json

API_KEY = os.environ["KIE_API_KEY"]
API_URL = "https://api.kie.ai/api/v1"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

OUT_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/logos/concept-v2"
os.makedirs(OUT_DIR, exist_ok=True)

# Retry for direction 3 (人工の獣). The first pass produced a front-facing
# esports-mascot wolf head (beast_a) and a snarling lion/tiger head with
# exposed fangs (beast_b) -- both explicitly on the brief's avoid-list.
# This pass forces an antique scientific-plate engraving register instead of
# a flat vector mascot logo, bans snarl/teeth/mascot framing directly, and
# fuses artificial geometry into the form rather than bolting on a badge.
concepts = [
    {
        "id": "beast_a2",
        "title": "人工の獣 A2 - Specimen Plate Engraving",
        "model": "flux-2/pro-text-to-image",
        "prompt": (
            "An antique 19th-century natural history specimen plate engraving of a wolf-like adapted "
            "creature's head and upper shoulder, in profile, mouth fully closed, calm and dignified "
            "expression, eyes half-lowered as if resting or observing, absolutely no snarl and no visible "
            "teeth. Thin cross-hatched copperplate linework only, no flat vector color fill, no cel-shading, "
            "no gradient, like a museum catalogue illustration. Along the jawline and shoulder the fine fur "
            "hatching gradually resolves into precise hexagonal metal plating and a small embedded "
            "gear-and-rivet seal, as if the creature were partly instrument. This must read as a scientific "
            "engraving plate, not a sports-team or gaming mascot logo, not a badge, not a crest, not "
            "centered heraldic framing. No moon, no text, no runes, no neon, no blood, no skull. Monochrome "
            "soot black and aged silver ink on aged paper texture, solid dark charcoal background, isolated "
            "centered composition."
        )
    },
    {
        "id": "beast_b2",
        "title": "人工の獣 B2 - Watching Eye Fragment",
        "model": "flux-2/pro-text-to-image",
        "prompt": (
            "A tight cropped fragment of an antique engraved illustration: only one calm, half-lidded "
            "wolf-like eye and the bridge of the muzzle, no ears, no full head, no mouth visible, not a "
            "portrait, not a logo mascot. Fine copperplate cross-hatch linework, no flat vector fill, no "
            "cel-shading. Around the eye the fur texture dissolves into thin engraved circuit-trace lines "
            "and one small precise aperture-lens ring in place of a pupil. Quiet, watchful, unsettling "
            "stillness rather than aggression -- absolutely no snarl, no exposed teeth, no roaring "
            "expression, no esports or gaming mascot styling. No moon, no text, no runes, no neon, no blood, "
            "no skull. Monochrome soot black and aged silver with a single faint dark crimson accent ring at "
            "the pupil, solid dark charcoal background, isolated centered composition."
        )
    },
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


def submit(concept):
    payload = {
        "model": concept["model"],
        "input": {
            "prompt": concept["prompt"],
            "aspect_ratio": "1:1",
            "resolution": "1K"
        }
    }
    for try_idx in range(3):
        try:
            r = requests.post(f"{API_URL}/jobs/createTask", json=payload, headers=HEADERS, timeout=30)
            res_json = r.json()
            if r.status_code == 200 and res_json.get("code") == 200:
                task_id = res_json.get("data", {}).get("taskId")
                print(f"  Submitted {concept['id']} ({concept['model']}): Task ID = {task_id}")
                return task_id
            else:
                print(f"  Error (try {try_idx+1}/3): {res_json}")
                time.sleep(3)
        except Exception as e:
            print(f"  Exception (try {try_idx+1}/3): {e}")
            time.sleep(3)
    return None


def main():
    print(f"Regenerating {len(concepts)} beast concept images (v2 retry, kie.ai)...")

    task_map = {}
    for c in concepts:
        print(f"Submitting {c['title']}...")
        task_id = submit(c)
        if task_id:
            task_map[c["id"]] = {"taskId": task_id, "concept": c}
        time.sleep(2.5)

    print(f"\nAll tasks submitted. Polling for {len(task_map)} tasks...")

    completed = {}
    failed = []
    start_time = time.time()
    timeout = 600

    while len(completed) + len(failed) < len(task_map):
        if time.time() - start_time > timeout:
            print("Session timeout reached!")
            break

        time.sleep(10)

        for cid, info in task_map.items():
            if cid in completed or cid in failed:
                continue

            task_id = info["taskId"]
            title = info["concept"]["title"]
            try:
                r = requests.get(f"{API_URL}/jobs/recordInfo?taskId={task_id}", headers=HEADERS, timeout=15)
                res_json = r.json()
                if r.status_code == 200 and res_json.get("code") == 200:
                    data = res_json.get("data", {})
                    status = data.get("state")
                    print(f"'{title}' status: {status}")

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
                            out_path = os.path.join(OUT_DIR, f"{cid}.png")
                            print(f"  Downloading {cid}...")
                            img_data = requests.get(url, timeout=30).content
                            with open(out_path, 'wb') as f:
                                f.write(img_data)
                            completed[cid] = out_path
                            print(f"  Saved {out_path}")
                        else:
                            print(f"  No URL for {cid}")
                            failed.append(cid)
                    elif status in ["fail", "error"]:
                        print(f"  Failed on KIE.AI for {cid}: {data.get('failMsg')}")
                        failed.append(cid)
            except Exception as e:
                print(f"  Polling error for {cid}: {e}")

        print(f"Progress: {len(completed)} completed, {len(failed)} failed out of {len(task_map)}")

    print("\n--- Beast Concept Retry Finished ---")
    print(f"Completed: {list(completed.keys())}")
    print(f"Failed: {failed}")


if __name__ == "__main__":
    main()
