import os
import shutil

src_dir = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/icons"
dst_dir = "/Users/takao/.gemini/antigravity-ide/brain/c3268d57-16e6-4226-8f97-26c14e19d2a4"

os.makedirs(dst_dir, exist_ok=True)

# Copy the pre-extracted icons to brain artifacts for markdown rendering
shutil.copy2(os.path.join(src_dir, "citizen.png"), os.path.join(dst_dir, "icon_citizen_preview.png"))
shutil.copy2(os.path.join(src_dir, "werewolf.png"), os.path.join(dst_dir, "icon_werewolf_preview.png"))
shutil.copy2(os.path.join(src_dir, "fox.png"), os.path.join(dst_dir, "icon_fox_preview.png"))
print("Copied all white outline icons to artifacts.")
