import os
from PIL import Image

output_dir = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/icons"
os.makedirs(output_dir, exist_ok=True)

camps = [
    {"id": "citizen", "src": "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/original-art/jinro00002.png"},
    {"id": "werewolf", "src": "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/original-art/jinro00015.png"},
    {"id": "fox", "src": "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/original-art/jinro00023.png"}
]

for camp in camps:
    if os.path.exists(camp["src"]):
        try:
            img = Image.open(camp["src"])
            # Crop emblem area
            emblem = img.crop((40, 855, 140, 955)) # 100x100
            
            # Convert to gray, threshold to make outline white, background black
            mask = emblem.convert("L")
            mask = mask.point(lambda p: 255 if p > 140 else 0)
            
            # Create transparent image with white color based on mask
            white_img = Image.new("RGBA", (100, 100), (255, 255, 255, 0))
            # Draw white pixel where mask is 255
            for x in range(100):
                for y in range(100):
                    if mask.getpixel((x, y)) == 255:
                        white_img.putpixel((x, y), (255, 255, 255, 255))
                        
            out_path = os.path.join(output_dir, f"{camp['id']}.png")
            white_img.save(out_path)
            print(f"Extracted {camp['id']} icon to {out_path}")
        except Exception as e:
            print(f"Failed to extract {camp['id']}: {e}")
    else:
        print(f"Source file not found: {camp['src']}")
