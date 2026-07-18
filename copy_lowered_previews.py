import os
import shutil

src_dir = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72-a"
dst_dir = "/Users/takao/.gemini/antigravity-ide/brain/c3268d57-16e6-4226-8f97-26c14e19d2a4"

# Copy the updated lowered-pose cards to brain artifacts for display
shutil.copy2(os.path.join(src_dir, "traitor_ver_a.png"), os.path.join(dst_dir, "test_72_traitor_ver_a.png"))
shutil.copy2(os.path.join(src_dir, "dictator_ver_a.png"), os.path.join(dst_dir, "test_72_dictator_ver_a.png"))
shutil.copy2(os.path.join(src_dir, "betrayal_twin_ver_a.png"), os.path.join(dst_dir, "test_72_betrayal_twin_ver_a.png"))

print("Copied lowered-pose previews to artifacts.")
