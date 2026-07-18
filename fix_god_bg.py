import os
import shutil

src = "/tmp/god_bg_raw.png"
dst = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/backgrounds-72/god_bg.png"

def main():
    if os.path.exists(src):
        shutil.copy2(src, dst)
        print(f"Successfully rescued and copied god_bg from {src} to {dst}")
    else:
        print(f"Error: Temporary file not found at {src}. Need to download it again.")
        # Fallback: Download again from the task output
        # Let's write a robust retry script just in case
        
if __name__ == "__main__":
    main()
