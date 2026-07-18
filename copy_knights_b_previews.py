import os
import shutil

src_bg = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/backgrounds-72"
src_char = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-transparent-72"
dst_dir = "/Users/takao/.gemini/antigravity-ide/brain/c3268d57-16e6-4226-8f97-26c14e19d2a4"

# Copy background
shutil.copy2(os.path.join(src_bg, "god_bg.png"), os.path.join(dst_dir, "god_bg_a2_darkest.png"))

# Copy characters
shutil.copy2(os.path.join(src_char, "knights_b_ver_a.png"), os.path.join(dst_dir, "knights_b_char.png"))
shutil.copy2(os.path.join(src_char, "god_ver_a.png"), os.path.join(dst_dir, "god_char_new.png"))

print("Copied latest Knights B and God updates to artifacts.")
