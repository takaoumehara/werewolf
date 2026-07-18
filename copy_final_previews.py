import os
import shutil

src_bg = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/backgrounds-72"
src_char = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-transparent-72"
dst_dir = "/Users/takao/.gemini/antigravity-ide/brain/c3268d57-16e6-4226-8f97-26c14e19d2a4"

# Copy backgrounds
shutil.copy2(os.path.join(src_bg, "god_bg.png"), os.path.join(dst_dir, "god_bg_a2_dark.png"))
shutil.copy2(os.path.join(src_bg, "spy_bg.png"), os.path.join(dst_dir, "spy_bg_a2_dark.png"))

# Copy transparent characters
shutil.copy2(os.path.join(src_char, "android_ver_a.png"), os.path.join(dst_dir, "android_char_zoomed.png"))
shutil.copy2(os.path.join(src_char, "werewolf_child_ver_a.png"), os.path.join(dst_dir, "werewolf_child_char_shifted.png"))

print("Copied final adjusted previews to artifacts.")
