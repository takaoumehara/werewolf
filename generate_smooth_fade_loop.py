import os
import sys
import subprocess
import shutil
from PIL import Image

PROJ_DIR = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム"
BG_PATH = os.path.join(PROJ_DIR, "backgrounds-72/werewolf_bg.png")
CHAR_A_PATH = os.path.join(PROJ_DIR, "raw-illustrations-transparent-72/werewolf_ver_a.png")
CHAR_B_PATH = os.path.join(PROJ_DIR, "raw-illustrations-transparent-72/werewolf_ver_b.png")
CHAR_C_PATH = os.path.join(PROJ_DIR, "raw-illustrations-transparent-72/werewolf_ver_c.png")

crop_box = (180, 50, 580, 570) # 400x520
TEMP_FRAMES_DIR = os.path.join(PROJ_DIR, "temp_frames")

def create_face_with_bg(char_path, bg_cropped):
    char = Image.open(char_path).convert("RGBA")
    char_cropped = char.crop(crop_box)
    face_merged = Image.alpha_composite(bg_cropped, char_cropped).convert("RGB")
    return face_merged

def generate_fade_loop():
    print("Generating zero-hallucination smooth morph loop using frame blending...")
    os.makedirs(TEMP_FRAMES_DIR, exist_ok=True)
    
    bg = Image.open(BG_PATH).convert("RGBA")
    bg_cropped = bg.crop(crop_box)
    
    # Generate A, B, C face images with background
    face_a = create_face_with_bg(CHAR_A_PATH, bg_cropped)
    face_b = create_face_with_bg(CHAR_B_PATH, bg_cropped)
    face_c = create_face_with_bg(CHAR_C_PATH, bg_cropped)
    
    # We want a loop: A -> B -> C -> A
    # Let's make each transition take 40 frames (at 30 fps, approx 1.3 seconds per transition)
    # Total frames = 120 (4 seconds loop)
    transition_frames = 40
    
    frame_idx = 0
    
    # 1. A -> B
    for i in range(transition_frames):
        alpha = i / transition_frames
        blended = Image.blend(face_a, face_b, alpha)
        blended.save(os.path.join(TEMP_FRAMES_DIR, f"frame_{frame_idx:04d}.png"))
        frame_idx += 1
        
    # 2. B -> C
    for i in range(transition_frames):
        alpha = i / transition_frames
        blended = Image.blend(face_b, face_c, alpha)
        blended.save(os.path.join(TEMP_FRAMES_DIR, f"frame_{frame_idx:04d}.png"))
        frame_idx += 1
        
    # 3. C -> A
    for i in range(transition_frames):
        alpha = i / transition_frames
        blended = Image.blend(face_c, face_a, alpha)
        blended.save(os.path.join(TEMP_FRAMES_DIR, f"frame_{frame_idx:04d}.png"))
        frame_idx += 1
        
    print(f"  Generated {frame_idx} blended keyframes in temp_frames/")
    
    # Compile frames to MP4 using FFmpeg
    final_out = os.path.join(PROJ_DIR, "videos-72/werewolf_face_loop.mp4")
    
    # ffmpeg command to compile png sequence to mp4
    cmd = [
        "ffmpeg", "-y",
        "-framerate", "30",
        "-i", os.path.join(TEMP_FRAMES_DIR, "frame_%04d.png"),
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "slow",
        "-crf", "18",
        final_out
    ]
    
    try:
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        print(f"  Successfully compiled perfect smooth fade loop video: {final_out}")
        
        # Copy to brain folder for preview
        subprocess.run(["cp", final_out, "/Users/takao/.gemini/antigravity-ide/brain/c3268d57-16e6-4226-8f97-26c14e19d2a4/werewolf_face_loop.mp4"], check=True)
        print("  Copied loop to brain folder.")
    except Exception as e:
        print(f"  FFmpeg compilation failed: {e}")
        
    # Clean up temp frames
    if os.path.exists(TEMP_FRAMES_DIR):
        shutil.rmtree(TEMP_FRAMES_DIR)
    print("  Cleaned up temporary frame images.")

if __name__ == "__main__":
    generate_fade_loop()
