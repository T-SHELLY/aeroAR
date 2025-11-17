#!/usr/bin/env python3
"""
QR Code Generator
Generates a QR code PNG image from any text input.
"""

import qrcode
from PIL import Image
import sys


def generate_qr_code(text, filename="qr_code.png", box_size=10, border=4):
    """
    Generate a QR code from text and save it as a PNG image.
    
    Args:
        text (str): The text content to encode in the QR code
        filename (str): Output filename for the PNG image (default: qr_code.png)
        box_size (int): Size of each box in pixels (default: 10)
        border (int): Border size in boxes (default: 4, minimum is 4)
    
    Returns:
        str: Path to the generated QR code image
    """
    # Create QR code instance
    qr = qrcode.QRCode(
        version=1,  # Controls the size (1 is smallest, None is auto)
        error_correction=qrcode.constants.ERROR_CORRECT_L,  # Error correction level
        box_size=box_size,
        border=border,
    )
    
    # Add data to the QR code
    qr.add_data(text)
    qr.make(fit=True)
    
    # Create an image from the QR code
    img = qr.make_image(fill_color="black", back_color="white")
    
    # Save the image
    img.save(filename)
    print(f"QR code successfully generated: {filename}")
    print(f"Encoded text: {text[:50]}{'...' if len(text) > 50 else ''}")
    
    return filename


def main():
    """Main function to handle command-line usage."""
    if len(sys.argv) < 2:
        print("Usage: python qr_generator.py <text> [output_filename]")
        print("\nExample:")
        print('  python qr_generator.py "Hello, World!" my_qr.png')
        print('  python qr_generator.py "Any text you want"')
        sys.exit(1)
    
    # Get text from command line
    text = sys.argv[1]
    
    # Get optional filename
    filename = sys.argv[2] if len(sys.argv) > 2 else "qr_code.png"
    
    # Generate QR code
    generate_qr_code(text, filename)


if __name__ == "__main__":
    main()