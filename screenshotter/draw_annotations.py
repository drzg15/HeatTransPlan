import sys
from PIL import Image

def crop_image(img_path, crop_box):
    try:
        img = Image.open(img_path)
    except Exception as e:
        print(f"Error opening image {img_path}: {e}")
        return

    # Crop the image
    img = img.crop(crop_box)
    img.save(img_path)
    print(f"Cropped {img_path}")


crop_image('../frontend/public/tutorial_step0.png', (0, 60, 1920, 1020))
crop_image('../frontend/public/tutorial_step1.png', (0, 60, 1920, 1020))
crop_image('../frontend/public/tutorial_step2.png', (0, 60, 1920, 1020))
crop_image('../frontend/public/tutorial_step3.png', (0, 60, 1920, 1020))
crop_image('../frontend/public/tutorial_step4.png', (0, 60, 1920, 1020))
crop_image('../frontend/public/tutorial_step5.png', (0, 60, 1920, 1020))
crop_image('../frontend/public/tutorial_step6.png', (0, 60, 1920, 1020))
