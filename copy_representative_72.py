import os
import shutil

src_dir = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72"
dst_dir = "/Users/takao/.gemini/antigravity-ide/brain/c3268d57-16e6-4226-8f97-26c14e19d2a4"

os.makedirs(dst_dir, exist_ok=True)

representatives = [
    "werewolf_ver_a.png", "werewolf_ver_b.png", "werewolf_ver_c.png",
    "prophet_ver_a.png", "prophet_ver_b.png", "prophet_ver_c.png",
    "betrayal_twin_ver_a.png", "betrayal_twin_ver_b.png", "betrayal_twin_ver_c.png",
    "mysterious_fox_ver_a.png", "mysterious_fox_ver_b.png", "mysterious_fox_ver_c.png"
]

for file in representatives:
    src_path = os.path.join(src_dir, file)
    dst_path = os.path.join(dst_dir, f"test_72_{file}")
    if os.path.exists(src_path):
        shutil.copy2(src_path, dst_path)
        print(f"Copied {file} to brain artifacts.")
    else:
        print(f"File {file} not found in src.")
