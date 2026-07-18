import os
import shutil

src_logos = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/logos"
src_viewer = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/logo_viewer.html"

dst_dir = "/Users/takao/.gemini/antigravity-ide/brain/c3268d57-16e6-4226-8f97-26c14e19d2a4"
dst_logos = os.path.join(dst_dir, "logos")
os.makedirs(dst_logos, exist_ok=True)

# Copy all logos
for i in range(1, 9):
    shutil.copy2(os.path.join(src_logos, f"logo_{i}.png"), os.path.join(dst_logos, f"logo_{i}.png"))
    
# Copy viewer
shutil.copy2(src_viewer, os.path.join(dst_dir, "logo_viewer.html"))

print("Successfully synced all 8 logos and viewer to artifacts.")
