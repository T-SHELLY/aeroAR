from flask import Flask, request, jsonify, send_from_directory, send_file, abort
import os
from werkzeug.utils import secure_filename

# Get the directory where this file is located
basedir = os.path.abspath(os.path.dirname(__file__))

app = Flask(__name__,
            static_folder=os.path.join(basedir, 'static'),
            static_url_path='')

# Configure folders
app.config['AUDIOS_FOLDER'] = os.path.join(basedir, 'audios')

# Ensure audios directory exists
os.makedirs(app.config['AUDIOS_FOLDER'], exist_ok=True)

@app.route('/')
def index():
    """Serve the main index page"""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/audios', methods=["GET"])
def audios():
    """
    Audio endpoint that receives a 'name' parameter via GET request
    and returns the audio file as an octet stream
    """
    name = request.args.get('name', '')

    if not name:
        print("No audio name provided")
        abort(400, description="Audio name parameter is required")

    # Sanitize the filename to prevent directory traversal attacks
    safe_name = secure_filename(name)

    # Construct the file path
    audio_filename = f"{safe_name}.mp3"
    audio_path = os.path.join(app.config['AUDIOS_FOLDER'], audio_filename)

    # Ensure the resolved path is within the audios directory (extra security)
    if not os.path.abspath(audio_path).startswith(os.path.abspath(app.config['AUDIOS_FOLDER'])):
        print(f"Path traversal attempt detected: {name}")
        abort(403, description="Invalid audio name")

    # Check if file exists
    if not os.path.exists(audio_path):
        print(f"Audio file not found: {audio_path}")
        abort(404, description=f"Audio file '{safe_name}' not found")

    print(f"Serving audio file: {audio_path}")

    # Send the file as an octet stream
    return send_file(
        audio_path,
        mimetype='application/octet-stream',
        as_attachment=True,
        download_name=audio_filename
    )

def run_server(host='0.0.0.0', port=9999, debug=True):
    """Run the Flask development server"""
    print(f"Starting AeroAR Flask application on port {port}...")
    app.run(host=host, port=port, debug=debug)
