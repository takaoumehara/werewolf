import os
import shutil

raw_src = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72"
card_src = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72"

raw_dst = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/raw-illustrations-72-a"
card_dst = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/generated-cards-72-a"

os.makedirs(raw_dst, exist_ok=True)
os.makedirs(card_dst, exist_ok=True)

# 1. Process Raw Illustrations
raw_files = os.listdir(raw_src)
raw_count = 0
for f in raw_files:
    if f.endswith("_ver_a.png") or f.endswith("_ver_a.jpg"):
        shutil.copy2(os.path.join(raw_src, f), os.path.join(raw_dst, f))
        raw_count += 1

# 2. Process Labeled Cards
card_files = os.listdir(card_src)
card_count = 0
for f in card_files:
    if f.endswith("_ver_a.png") or f.endswith("_ver_a.jpg"):
        shutil.copy2(os.path.join(card_src, f), os.path.join(card_dst, f))
        card_count += 1

print(f"Successfully copied {raw_count} raw Ver.A images to {raw_dst}")
print(f"Successfully copied {card_count} labeled Ver.A cards to {card_dst}")
