import os
import shutil

src_dir = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72-a"
dst_dir = "/Users/takao/.gemini/antigravity-ide/brain/c3268d57-16e6-4226-8f97-26c14e19d2a4"

# Copy the updated upper-margin cards to brain artifacts
shutil.copy2(os.path.join(src_dir, "mysterious_fox_ver_a.png"), os.path.join(dst_dir, "test_72_mysterious_fox_ver_a.png"))
shutil.copy2(os.path.join(src_dir, "counselor_ver_a.png"), os.path.join(dst_dir, "test_72_counselor_ver_a.png"))

print("Copied updated upper-margin cards to artifacts.")
