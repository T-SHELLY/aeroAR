import os
import glob
import io
import zipfile
import qrcode
from werkzeug.utils import secure_filename

def generate_module_qr_zip(module_folder):
    """
    Generates a ZIP file containing QR codes for all .wav files in the module folder.
    Returns a BytesIO object containing the ZIP file data.
    """
    # Create in-memory zip
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        # Find all .wav files
        wav_files = glob.glob(os.path.join(module_folder, "*.wav"))
        
        for wav_path in wav_files:
            # Strip directory path and extension to get the name
            filename = os.path.basename(wav_path)
            name_only = os.path.splitext(filename)[0]
            
            # Generate QR Code
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_L,
                box_size=10,
                border=4,
            )
            qr.add_data(name_only)
            qr.make(fit=True)
            
            img = qr.make_image(fill_color="black", back_color="white")
            
            # Save QR image to memory
            img_buffer = io.BytesIO()
            img.save(img_buffer, format="PNG")
            img_buffer.seek(0)
            
            # Add to ZIP
            # We'll name the QR file same as the audio file but with .png
            zip_file.writestr(f"{name_only}.png", img_buffer.getvalue())
            
    zip_buffer.seek(0)
    return zip_buffer
