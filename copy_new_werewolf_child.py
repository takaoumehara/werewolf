import os
import shutil

src_dir = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72"
dst_dir = "/Users/takao/.gemini/antigravity-ide/brain/c3268d57-16e6-4226-8f97-26c14e19d2a4"

os.makedirs(dst_dir, exist_ok=True)

# Copy the newly redrawn werewolf child variants to brain artifacts
shutil.copy2(os.path.join(src_dir, "werewolf_child_ver_a.png"), os.path.join(dst_dir, "test_72_werewolf_child_ver_a.png"))
shutil.copy2(os.path.join(src_dir, "werewolf_child_ver_b.png"), os.path.join(dst_dir, "test_72_werewolf_child_ver_b.png"))
print("Copied new werewolf child variants to artifacts.")
