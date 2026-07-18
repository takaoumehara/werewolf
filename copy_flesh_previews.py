import os
import shutil

src_dir = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72-a"
dst_dir = "/Users/takao/.gemini/antigravity-ide/brain/c3268d57-16e6-4226-8f97-26c14e19d2a4"

os.makedirs(dst_dir, exist_ok=True)

# Copy the updated bone-free cards to brain artifacts
shutil.copy2(os.path.join(src_dir, "mysterious_fox_ver_a.png"), os.path.join(dst_dir, "test_72_mysterious_fox_ver_a.png"))
shutil.copy2(os.path.join(src_dir, "double_ver_a.png"), os.path.join(dst_dir, "test_72_double_ver_a.png"))
print("Copied updated bone-free cards to artifacts.")
