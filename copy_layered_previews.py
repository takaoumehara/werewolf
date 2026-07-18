import os
import shutil

src_bg = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/backgrounds-72"
src_char = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-transparent-72"
dst_dir = "/Users/takao/.gemini/antigravity-ide/brain/c3268d57-16e6-4226-8f97-26c14e19d2a4"

# Copy backgrounds
shutil.copy2(os.path.join(src_bg, "dictator_bg.png"), os.path.join(dst_dir, "dictator_bg_a2.png"))
shutil.copy2(os.path.join(src_bg, "mysterious_fox_bg.png"), os.path.join(dst_dir, "mysterious_fox_bg_a2.png"))
shutil.copy2(os.path.join(src_bg, "werewolf_bg.png"), os.path.join(dst_dir, "werewolf_bg_a2.png"))

# Copy transparent characters
shutil.copy2(os.path.join(src_char, "dictator_ver_a.png"), os.path.join(dst_dir, "dictator_char_transparent.png"))
shutil.copy2(os.path.join(src_char, "mysterious_fox_ver_a.png"), os.path.join(dst_dir, "mysterious_fox_char_transparent.png"))

print("Copied layered previews to artifacts.")
