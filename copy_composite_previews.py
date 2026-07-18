import os
import shutil

src_dir = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72-a2"
dst_dir = "/Users/takao/.gemini/antigravity-ide/brain/c3268d57-16e6-4226-8f97-26c14e19d2a4"

# Copy composited (no-text) representatives to brain artifacts
shutil.copy2(os.path.join(src_dir, "dictator_ver_a.png"), os.path.join(dst_dir, "test_72_dictator_ver_a2_composite.png"))
shutil.copy2(os.path.join(src_dir, "mysterious_fox_ver_a.png"), os.path.join(dst_dir, "test_72_mysterious_fox_ver_a2_composite.png"))

print("Copied composited card previews to artifacts.")
