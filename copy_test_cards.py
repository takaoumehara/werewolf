import os
import shutil

src_dir = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/test-generated-cards"
dst_dir = "/Users/takao/.gemini/antigravity-ide/brain/c3268d57-16e6-4226-8f97-26c14e19d2a4"

os.makedirs(dst_dir, exist_ok=True)

for file in ["werewolf.png", "citizen.png", "prophet.png"]:
    src_path = os.path.join(src_dir, file)
    dst_path = os.path.join(dst_dir, f"test_{file}")
    shutil.copy2(src_path, dst_path)
    print(f"Copied {file} as test_{file} to artifact directory.")
