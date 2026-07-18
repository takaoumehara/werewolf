import os
import shutil

src_path = "/Users/takao/Documents/00_Product_Develpment/Game/人狼ゲーム/test-twin-variants/betrayal_twin_ver_c.png"
dst_path = "/Users/takao/.gemini/antigravity-ide/brain/c3268d57-16e6-4226-8f97-26c14e19d2a4/test_betrayal_twin_ver_c.png"

shutil.copy2(src_path, dst_path)
print("Copied betrayal_twin_ver_c.png as test_betrayal_twin_ver_c.png to artifact directory.")
