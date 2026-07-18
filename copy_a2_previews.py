import os
import shutil

src_dir = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72-a2"
dst_dir = "/Users/takao/.gemini/antigravity-ide/brain/c3268d57-16e6-4226-8f97-26c14e19d2a4"

# Copy representatives of A2 series to brain artifacts
shutil.copy2(os.path.join(src_dir, "dictator_ver_a.png"), os.path.join(dst_dir, "test_72_dictator_ver_a2.png"))
shutil.copy2(os.path.join(src_dir, "mysterious_fox_ver_a.png"), os.path.join(dst_dir, "test_72_mysterious_fox_ver_a2.png"))
shutil.copy2(os.path.join(src_dir, "traitor_ver_a.png"), os.path.join(dst_dir, "test_72_traitor_ver_a2.png"))

print("Copied final A2 series previews to artifacts.")
