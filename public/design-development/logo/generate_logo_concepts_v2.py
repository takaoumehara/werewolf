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

# Three brief directions from prompts/claude-design/01-logo-design-prompt.md,
# two variants each, deliberately avoiding the "avoid" list (no front-facing
# wolf head + moon pairing, no shield-centered crest, no esports/metal-band
# wolf, no claw-marks-only, no skull/blood/fang excess, no runes, no neon).
concepts = [
    {
        "id": "recorder_a",
        "title": "記録者の紋章 A - Iris Gate Seal",
        "model": "flux-2/pro-text-to-image",
        "prompt": (
            "A precise emblem logo for a neutral archival AI system, fine antique engraving linework, "
            "vintage copperplate etching style. A circular seal where a camera-iris aperture made of "
            "interlocking metal petals doubles as a keyhole and a gate archway, one petal etched with a "
            "subtle crescent-moon phase, faint circuit traces radiating outward like an observation network. "
            "No wolf, no animal, no text, no runes. Clean vector-ready silhouette, monochrome soot black and "
            "aged silver on solid dark charcoal background. Isolated centered design."
        )
    },
    {
        "id": "recorder_b",
        "title": "記録者の紋章 B - Moon Terminal Eye",
        "model": "google/nano-banana",
        "prompt": (
            "A minimal official archive stamp emblem, fine engraved linework in the style of an antique "
            "authentication seal. A single vertical keyhole shape fused with a half-open eye, the eye's iris "
            "rendered as a crescent moon divided into thin circuit-board traces, thin concentric ring border "
            "like an old terminal readout. No wolf, no animal, no text, no runes, no neon glow. Clean flat "
            "vector silhouette, monochrome soot black and oxidized silver, solid dark charcoal background, "
            "centered isolated design."
        )
    },
    {
        "id": "gate_a",
        "title": "最後の門 A - Cracked Moon Archway",
        "model": "flux-2/pro-text-to-image",
        "prompt": (
            "A negative-space emblem logo of a tall gothic fortress gate, fine antique engraving linework, "
            "vintage etching style. The empty archway opening is shaped exactly like a cracked crescent moon, "
            "one thin fracture line running down through the gate itself like a broken mirror, symmetrical "
            "iron-riveted door leaves on either side. No wolf, no animal, no text, no runes, no neon. Clean "
            "vector-ready silhouette, monochrome soot black and aged silver, solid dark charcoal background, "
            "centered isolated design."
        )
    },
    {
        "id": "gate_b",
        "title": "最後の門 B - Broken Mirror Doors",
        "model": "google/nano-banana",
        "prompt": (
            "A symmetrical emblem logo of two closed fortress gate leaves meeting at a center seam, fine "
            "antique engraving linework, vintage etching style. A single jagged crack runs down the seam like "
            "a shattered mirror, and the crack reflects a faint distorted silhouette of a second, slightly "
            "offset gate behind it, suggesting what is inside may not be what it seems. No wolf, no animal, "
            "no text, no runes, no neon. Clean vector-ready silhouette, monochrome soot black and aged silver, "
            "solid dark charcoal background, centered isolated design."
        )
    },
    {
        "id": "beast_a",
        "title": "人工の獣 A - Faceted Beast Seam",
        "model": "flux-2/pro-text-to-image",
        "prompt": (
            "A restrained emblem logo of a wolf-like beast silhouette in profile, head slightly lowered and "
            "watchful rather than snarling, fine antique engraving linework, vintage etching style. The body "
            "is built from precise angular polygon facets with visible circuit-trace seams running along the "
            "joints, one small round authentication rivet-seal embedded near the shoulder. Calm, dignified, "
            "not aggressive, not an esports mascot. No moon, no text, no runes, no neon, no skull, no blood, "
            "no exaggerated fangs. Clean vector-ready silhouette, monochrome soot black and aged silver with "
            "one small dark oxidized-green accent at the seal, solid dark charcoal background, centered "
            "isolated design."
        )
    },
    {
        "id": "beast_b",
        "title": "人工の獣 B - Fur to Plating Fragment",
        "model": "google/nano-banana",
        "prompt": (
            "An abstract partial emblem logo showing only a fragment of a beast's jaw and eye in profile, not "
            "a full front-facing head, fine antique engraving linework, vintage etching style. On one side "
            "fine engraved fur texture, on the other side the same contour resolves into hexagonal armor "
            "plating with faint hairline wiring seams, one eye rendered as a small precise aperture lens. "
            "Calm and watchful, not snarling, not an esports mascot. No moon, no text, no runes, no neon, no "
            "skull, no blood, no exaggerated fangs. Clean vector-ready silhouette, monochrome soot black and "
            "aged silver with one small dark crimson accent at the eye, solid dark charcoal background, "
            "centered isolated design."
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
    if concept["model"] == "flux-2/pro-text-to-image":
        payload = {
            "model": concept["model"],
            "input": {
                "prompt": concept["prompt"],
                "aspect_ratio": "1:1",
                "resolution": "1K"
            }
        }
    else:
        payload = {
            "model": concept["model"],
            "input": {
                "prompt": concept["prompt"],
                "image_size": "1:1",
                "output_format": "png"
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
    print(f"Generating {len(concepts)} logo concept images (v2, kie.ai)...")

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
    timeout = 900

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

    print("\n--- Logo Concept v2 Generation Finished ---")
    print(f"Completed: {list(completed.keys())}")
    print(f"Failed: {failed}")


if __name__ == "__main__":
    main()
