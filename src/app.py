from flask import Flask, request, jsonify, send_from_directory
import os

# Get the directory where this file is located
basedir = os.path.abspath(os.path.dirname(__file__))

app = Flask(__name__,
            static_folder=os.path.join(basedir, 'static'),
            static_url_path='')

# Configure folders
app.config['AUDIOS_FOLDER'] = os.path.join(basedir, 'audios')

@app.route('/')
def index():
    """Serve the main index page"""
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/audios')
def audios():
    """
    Audio endpoint that receives a 'name' parameter via GET request
    and returns audio information
    """
    name = request.args.get('name', '')
    code = request.args.get('code', '')  # Alternative parameter name

    # Print the received parameter
    print(f"Received audio request - name: {name}, code: {code}")

    # Return JSON response
    response_data = {
        'status': 'success',
        'name': name or code,
        'message': f'Audio request received for: {name or code}'
    }

    return jsonify(response_data)

def run_server(host='0.0.0.0', port=9999, debug=True):
    """Run the Flask development server"""
    print(f"Starting AeroAR Flask application on port {port}...")
    app.run(host=host, port=port, debug=debug)
