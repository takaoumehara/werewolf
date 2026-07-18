import os
import sys
import time
import requests
import json
import subprocess
import shutil
from PIL import Image

API_KEY = "f42bc196113ea943377f64713e5aebf2"
API_URL = "https://api.kie.ai/api/v1"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

PROJ_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム"
BG_DIR = os.path.join(PROJ_DIR, "backgrounds-72")
CHAR_DIR = os.path.join(PROJ_DIR, "raw-illustrations-transparent-72")
VIDEO_OUT_DIR = os.path.join(PROJ_DIR, "videos-72")
os.makedirs(VIDEO_OUT_DIR, exist_ok=True)

roles_to_animate = [
    {
        "id": "werewolf",
        "bg": "werewolf_bg.png",
        "char": "werewolf_ver_a.png",
        "prompt": "spooky night wolf breathing subtly, fur swaying gently in the wind, red moonlight shifting shadows on its shoulders, high-contrast G-pen engraving style, no camera motion, seamless forward loop"
    },
    {
        "id": "magician",
        "bg": "magician_bg.png",
        "char": "magician_ver_a.png",
        "prompt": "mysterious magician standing, purple glowing magic orb in hand slowly shimmers and casts shifting violet light on the magician, floating playing cards vibrate slightly, G-pen engraving textures, static camera, seamless forward loop"
    },
    {
        "id": "bodyguard",
        "bg": "bodyguard_bg.png",
        "char": "bodyguard_ver_a.png",
        "prompt": "noble knight bodyguard holding a shield, G-pen cross-hatching armor textures, orange backlight glows and ebbs subtly like fire embers, static camera, seamless forward loop"
    }
]

def merge_layers(role):
    print(f"Merging layers for {role['id']}...")
    bg_path = os.path.join(BG_DIR, role["bg"])
    char_path = os.path.join(CHAR_DIR, role["char"])
    out_path = os.path.join(PROJ_DIR, f"temp_merged_{role['id']}.png")
    
    if not os.path.exists(bg_path) or not os.path.exists(char_path):
        print(f"Error: Missing assets for {role['id']}")
        return None
        
    bg_img = Image.open(bg_path).convert("RGBA")
    char_img = Image.open(char_path).convert("RGBA")
    
    # Resize char to match bg size if necessary
    if char_img.size != bg_img.size:
        char_img = char_img.resize(bg_img.size, Image.Resampling.LANCZOS)
        
    # Alpha composite
    merged = Image.alpha_composite(bg_img, char_img)
    merged.convert("RGB").save(out_path, "PNG")
    print(f"  Saved merged image: {out_path}")
    return out_path

def git_push_temp_images():
    print("Committing and pushing temporary merged images to GitHub...")
    try:
        subprocess.run(["git", "add", "temp_merged_*.png"], cwd=PROJ_DIR, check=True)
        subprocess.run(["git", "commit", "-m", "chore: add temp merged images for video generation"], cwd=PROJ_DIR, check=True)
        subprocess.run(["git", "push"], cwd=PROJ_DIR, check=True)
        print("  Successfully pushed to GitHub!")
        return True
    except Exception as e:
        print(f"Git push failed: {e}")
        return False

def make_loop_ffmpeg(in_path, out_path):
    print(f"Applying forward crossfade loop to {in_path} using FFmpeg...")
    # Kling/Runway generated videos are typically 5 seconds.
    # We crop 0 to 4s as Part A, and 4 to 5s as Part B.
    # Then we crossfade Part B over Part A at the very start (0s) with 1.0s duration.
    cmd = [
        "ffmpeg", "-y", "-i", in_path,
        "-filter_complex",
        "[0:v]split[a][b];"
        "[a]trim=0:4,setpts=PTS-STARTPTS[a1];"
        "[b]trim=4:5,setpts=PTS-STARTPTS[b1];"
        "[b1][a1]xfade=transition=fade:duration=1.0:offset=0,setsar=1[v]",
        "-map", "[v]", out_path
    ]
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"  Created seamless forward loop video: {out_path}")
        return True
    except Exception as e:
        print(f"FFmpeg crossfade failed: {e}")
        # Fallback: copy original if FFmpeg fails
        try:
            shutil.copy(in_path, out_path)
            print("  Fallback: copied original video without crossfade.")
            return True
        except:
            return False

def main():
    # 1. Merge layers
    merged_files = {}
    for role in roles_to_animate:
        path = merge_layers(role)
        if path:
            merged_files[role["id"]] = path
            
    if not merged_files:
        print("No files merged.")
        return
        
    # 2. Push to Git to get public URLs
    if not git_push_temp_images():
        print("Failed to upload temporary images to GitHub. Cannot proceed with API.")
        return
        
    # 3. Submit tasks to KIE.ai Runway Gen3 Image-to-Video API
    tasks = {}
    for role in roles_to_animate:
        role_id = role["id"]
        img_url = f"https://raw.githubusercontent.com/takaoumehara/werewolf/main/temp_merged_{role_id}.png"
        print(f"Submitting video task for {role_id}...")
        
        payload = {
            "prompt": role["prompt"],
            "image": img_url,
            "aspect_ratio": "9:16",
            "duration": 5,
            "quality": "720p"
        }
        
        try:
            r = requests.post(f"{API_URL}/runway/generate", json=payload, headers=HEADERS, timeout=20)
            res = r.json()
            if r.status_code == 200 and res.get("code") == 200:
                task_id = res.get("data", {}).get("taskId")
                tasks[role_id] = task_id
                print(f"  Task submitted successfully. ID: {task_id}")
            else:
                print(f"  Failed to submit {role_id}: {res}")
        except Exception as e:
            print(f"  Error submitting {role_id}: {e}")
            
    if not tasks:
        print("No tasks submitted successfully.")
        return
        
    # 4. Poll tasks
    print("\nPolling video generation tasks...")
    completed_videos = {}
    start_time = time.time()
    timeout = 600 # 10 mins
    
    active_roles = list(tasks.keys())
    
    while active_roles:
        if time.time() - start_time > timeout:
            print("Timeout reached! Some tasks are still generating.")
            break
            
        time.sleep(20)
        roles_to_check = list(active_roles)
        
        for role_id in roles_to_check:
            task_id = tasks[role_id]
            try:
                r = requests.get(f"{API_URL}/runway/record-detail?taskId={task_id}", headers=HEADERS, timeout=15)
                res = r.json()
                if r.status_code == 200 and res.get("code") == 200:
                    data = res.get("data", {})
                    state = data.get("state")
                    print(f"Task {role_id} ({task_id}): {state}")
                    
                    if state == "success":
                        video_info = data.get("videoInfo")
                        video_url = video_info.get("videoUrl") if video_info else None
                        if video_url:
                            # Download temporary raw video
                            temp_video_path = os.path.join(VIDEO_OUT_DIR, f"temp_raw_{role_id}.mp4")
                            print(f"  Downloading generated raw video for {role_id}...")
                            video_data = requests.get(video_url, timeout=40).content
                            with open(temp_video_path, 'wb') as f:
                                f.write(video_data)
                                
                            # Convert to perfect forward loop
                            final_video_path = os.path.join(VIDEO_OUT_DIR, f"{role_id}.mp4")
                            make_loop_ffmpeg(temp_video_path, final_video_path)
                            
                            # Clean up temp raw video
                            if os.path.exists(temp_video_path):
                                os.remove(temp_video_path)
                                
                            completed_videos[role_id] = final_video_path
                            active_roles.remove(role_id)
                        else:
                            print(f"  Error: Task succeeded but no videoUrl found for {role_id}")
                            active_roles.remove(role_id)
                    elif state in ["fail", "error"]:
                        print(f"  Task failed for {role_id}: {data.get('failMsg')}")
                        active_roles.remove(role_id)
            except Exception as e:
                print(f"  Error polling {role_id}: {e}")
                
    print("\nVideo generation completed!")
    print(f"Generated loops: {completed_videos}")

if __name__ == "__main__":
    main()
