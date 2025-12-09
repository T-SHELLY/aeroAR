from flask import Flask, request, jsonify, send_from_directory, send_file, abort, render_template, session, redirect, url_for
from werkzeug.utils import secure_filename
from datetime import timedelta
import os
import re
import hashlib
import secrets
import shutil
import threading
import glob
import json

from src.utils.audio_processor import convert_to_wav, transcribe_audio

# Get the directory where this file is located
basedir = os.path.abspath(os.path.dirname(__file__))

app = Flask(__name__,
            static_folder=os.path.join(basedir, 'static'),
            static_url_path='')

# Configuration
app.secret_key = os.environ.get('SECRET_KEY', 'hardcoded_secret_key_for_demo_purposes_only') # IN PRODUCTION USE ENV VAR
app.permanent_session_lifetime = timedelta(hours=6)
app.config['MODULES_FOLDER'] = os.path.join(basedir, 'modules')
app.config['DEMO_FOLDER'] = os.path.join(app.config['MODULES_FOLDER'], 'demo')

# Ensure modules directory exists
os.makedirs(app.config['MODULES_FOLDER'], exist_ok=True)

@app.route('/')
@app.route('/index.html')
def index():
    """Serve the main index page"""
    return render_template('index.html')

@app.route('/scan.html')
def scan_page():
    role = session.get('role')
    module_info = None
    
    if role == 'trainee':
        module_code = session.get('module_code')
        if module_code:
            # Try to read module details
            module_folder = os.path.join(app.config['MODULES_FOLDER'], secure_filename(module_code))
            name_file = os.path.join(module_folder, 'name.txt')
            trainer_file = os.path.join(module_folder, 'trainer.txt')
            
            module_name = "Unknown Module"
            trainer_name = "Unknown Trainer"
            
            if os.path.exists(name_file):
                with open(name_file, 'r') as f:
                    module_name = f.read().strip()
            
            if os.path.exists(trainer_file):
                with open(trainer_file, 'r') as f:
                    trainer_name = f.read().strip()
            
            module_info = {
                'name': module_name,
                'trainer': trainer_name,
                'is_demo': False
            }
    
    # If no valid module info found (guest or just generic access), treat as demo
    if not module_info:
        module_info = {
            'name': 'DEMO MODE',
            'trainer': 'Guest Access',
            'is_demo': True
        }
        
    return render_template('scan.html', module_info=module_info)

@app.route('/glossary')
def glossary():
    role = session.get('role')
    module_folder = None
    
    # Determine which folder to read from
    is_demo = False
    if role == 'trainee':
        module_code = session.get('module_code')
        if module_code:
            module_folder = os.path.join(app.config['MODULES_FOLDER'], secure_filename(module_code))
    
    # Fallback to demo folder if no valid trainee module or if guest
    if not module_folder or not os.path.exists(module_folder):
        module_folder = app.config['DEMO_FOLDER']
        is_demo = True
    
    # Read transcripts.json
    items = []
    json_path = os.path.join(module_folder, 'transcripts.json')
    if os.path.exists(json_path):
        try:
            with open(json_path, 'r') as f:
                items = json.load(f)
        except Exception as e:
            print(f"Error reading glossary data: {e}")
            
    return render_template('glossary.html', items=items, is_demo=is_demo)

def is_valid_module_code(code):
    """
    Validates that the module code is exactly 10 uppercase hexadecimal characters.
    Returns True if valid, False otherwise.
    """
    if not code:
        return False
    if code.lower() == 'demo':
        return True
    return bool(re.fullmatch(r'[0-9A-F]{10}', code))

def process_module_background(module_folder, tasks):
    """
    Background worker to process audio files.
    tasks: list of dicts {'raw_path': str, 'final_wav_path': str, 'real_name': str, 'transcript_text': str}
    """
    try:
        status_file = os.path.join(module_folder, 'status.txt')
        transcript_json_file = os.path.join(module_folder, 'transcripts.json')
        results = []
        
        for task in tasks:
            raw_path = task['raw_path']
            final_wav_path = task['final_wav_path']
            real_name = task['real_name']
            provided_text = task['transcript_text']
            
            # The filename relative to the module folder
            filename = os.path.basename(final_wav_path)

            # 1. Convert/Move to WAV
            if raw_path != final_wav_path:
                # Need conversion
                with open(raw_path, 'rb') as f:
                    wav_data = convert_to_wav(f)
                
                if wav_data:
                    with open(final_wav_path, 'wb') as f:
                        f.write(wav_data.read())
                    # Clean up raw file
                    try:
                        os.remove(raw_path)
                    except OSError:
                        pass
                else:
                    # Conversion failed
                    print(f"Failed to convert {raw_path}")
                    continue
            
            # 2. Transcribe
            final_transcript = ""
            if provided_text:
                final_transcript = provided_text
            else:
                final_transcript = transcribe_audio(final_wav_path)
            
            results.append({
                "name": real_name,
                "transcript": final_transcript,
                "filename": filename 
            })
        
        # Write transcripts.json
        with open(transcript_json_file, 'w') as f:
            json.dump(results, f, indent=2)
        
        # Update Status to COMPLETE
        with open(status_file, 'w') as f:
            f.write("COMPLETE")
            
    except Exception as e:
        print(f"Background processing error: {e}")
        try:
            with open(status_file, 'w') as f:
                f.write(f"ERROR: {str(e)}")
        except:
            pass

@app.route('/login/trainer', methods=['GET', 'POST'])
def login_trainer():
    if request.method == 'POST':
        username = request.form.get('username').strip()
        password = request.form.get('password')
        
        # Hardcoded credentials for demo
        expected_user = "DemoTrainer"
        expected_pass_hash = "2722c519d41f20fe7c4d76aff1948cd229f1a0a82bd0be91316ebcfed507b048"
        
        if username.lower() == expected_user.lower():
            # Hash the input password
            input_hash = hashlib.sha256(password.encode()).hexdigest()
            if input_hash == expected_pass_hash:
                session.permanent = True
                session['role'] = 'trainer'
                session['username'] = expected_user
                return redirect(url_for('index'))
        
        return render_template('login_trainer.html', error="Invalid username or password")
    
    return render_template('login_trainer.html')

@app.route('/trainer/create_module', methods=['GET', 'POST'])
def create_module():
    if session.get('role') != 'trainer':
        return redirect(url_for('login_trainer'))

    if request.method == 'POST':
        try:
            module_name = request.form.get('module_name', '').strip()
            names = request.form.getlist('names[]')
            files = request.files.getlist('files[]')
            transcripts = request.form.getlist('transcripts[]')

            if not module_name:
                return "Error: Module name is required", 400

            if not names or not files or len(names) != len(files):
                return "Error: Data mismatch", 400

            # Generate Module Code (10 chars hex = 5 bytes)
            module_code = secrets.token_hex(5).upper()
            module_folder = os.path.join(app.config['MODULES_FOLDER'], module_code)
            os.makedirs(module_folder, exist_ok=True)

            # Save trainer info & Initial Status
            with open(os.path.join(module_folder, 'trainer.txt'), 'w') as f:
                f.write(session.get('username', 'Unknown'))
            
            with open(os.path.join(module_folder, 'name.txt'), 'w') as f:
                f.write(module_name)
            
            with open(os.path.join(module_folder, 'status.txt'), 'w') as f:
                f.write("PROCESSING")

            # Prepare tasks for background thread
            bg_tasks = []

            for i, name in enumerate(names):
                if not name.strip():
                    continue

                file_obj = files[i]
                if file_obj.filename == '':
                    continue
                
                safe_name = secure_filename(name.strip())
                base_path = os.path.join(module_folder, safe_name)
                final_wav_path = f"{base_path}.wav"
                
                original_filename = secure_filename(file_obj.filename)
                _, ext = os.path.splitext(original_filename)
                
                # Save the RAW file first (so thread can read it)
                # We use a temp name to avoid conflict if user uploaded 'foo.wav' but we want 'safe.wav'
                raw_path = os.path.join(module_folder, f"temp_{i}{ext}")
                file_obj.save(raw_path)

                transcript_val = transcripts[i].strip() if i < len(transcripts) else ""
                
                bg_tasks.append({
                    'raw_path': raw_path,
                    'final_wav_path': final_wav_path,
                    'real_name': name.strip(),
                    'transcript_text': transcript_val
                })

            # Start background thread
            thread = threading.Thread(target=process_module_background, args=(module_folder, bg_tasks))
            thread.daemon = True
            thread.start()

            # Pass success flag to index (or list modules page)
            return redirect(url_for('list_modules'))

        except Exception as e:
            print(f"Error creating module: {e}")
            return f"Error: {e}", 500

    return render_template('create_module.html')

@app.route('/login/trainee', methods=['GET', 'POST'])
def login_trainee():
    if request.method == 'POST':
        module_code = request.form.get('module_code', '').strip().upper()
        
        if module_code.lower() == 'demo':
             return render_template('login_trainee.html', error="For demo access, please use the 'Demo Scan' button on the home page.")

        # Use helper for validation
        if not is_valid_module_code(module_code):
             return render_template('login_trainee.html', error="Invalid module code format (must be 10 hex characters)")

        # Check if the module exists in our file system
        module_path = os.path.join(app.config['MODULES_FOLDER'], module_code)
        
        # Verify it is a valid directory
        if os.path.exists(module_path) and os.path.isdir(module_path):
            session.permanent = True
            session['role'] = 'trainee'
            session['module_code'] = module_code
            
            # Read module name
            name_file = os.path.join(module_path, 'name.txt')
            module_name = module_code # Default to code if no name
            if os.path.exists(name_file):
                with open(name_file, 'r') as f:
                    module_name = f.read().strip()
            session['module_name'] = module_name
            
            return redirect(url_for('index'))
            
        return render_template('login_trainee.html', error="Module code not found")

    return render_template('login_trainee.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.route('/audios', methods=["GET"])
def audios():
    """
    Audio endpoint that receives a 'name' parameter via GET request
    and returns the audio file as an octet stream.
    If a trainee is logged in, it looks in a subfolder named after the module code.
    """
    name = request.args.get('name', '')

    if not name:
        print("No audio name provided")
        abort(400, description="Audio name parameter is required")

    # Sanitize the filename to prevent directory traversal attacks
    safe_name = secure_filename(name)
    audio_filename = f"{safe_name}.wav"
    
    # Construct base folder path (Default to Modules folder)
    base_folder = app.config['MODULES_FOLDER']
    
    # If user is a trainee, look in their module folder
    role = session.get('role')
    if role == 'trainee':
        module_code = session.get('module_code')
        if module_code:
            # Securely join module code
            safe_module = secure_filename(module_code)
            base_folder = os.path.join(base_folder, safe_module)
    elif role == 'trainer':
        # TODO: Implement trainer audio serving
        abort(403, description="Trainer audio serving not implemented")
    else:
        # User is using demo version of the scanner, serve from demo folder
        base_folder = app.config['DEMO_FOLDER']

    # Construct full file path
    audio_path = os.path.join(base_folder, audio_filename)

    # Ensure the resolved path is within the config directory (extra security)
    # We verify it's inside the MAIN modules folder to allow subfolders
    if not os.path.abspath(audio_path).startswith(os.path.abspath(app.config['MODULES_FOLDER'])):
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
        mimetype='audio/wav',
        as_attachment=True,
        download_name=audio_filename
    )

@app.route('/trainer/modules')
def list_modules():
    if session.get('role') != 'trainer':
        return redirect(url_for('login_trainer'))

    current_user = session.get('username')
    modules = []
    
    # Scan modules folder
    modules_folder = app.config['MODULES_FOLDER']
    if os.path.exists(modules_folder):
        for folder_name in os.listdir(modules_folder):
            folder_path = os.path.join(modules_folder, folder_name)
            
            if os.path.isdir(folder_path):
                trainer_file = os.path.join(folder_path, 'trainer.txt')
                status_file = os.path.join(folder_path, 'status.txt')
                
                # Check if this module belongs to the current trainer
                if os.path.exists(trainer_file):
                    with open(trainer_file, 'r') as f:
                        owner = f.read().strip()
                    
                    if owner == current_user:
                        # Get Status
                        status = "UNKNOWN"
                        if os.path.exists(status_file):
                            with open(status_file, 'r') as f:
                                status = f.read().strip()
                        
                        # Read Module Name
                        name_file = os.path.join(folder_path, 'name.txt')
                        module_name = "Untitled Module"
                        if os.path.exists(name_file):
                            with open(name_file, 'r') as f:
                                module_name = f.read().strip()

                        module_data = {
                            'code': folder_name,
                            'name': module_name,
                            'status': status,
                            'content_items': []
                        }
                        
                        # If complete, list files from transcripts.json
                        if status == 'COMPLETE':
                            json_path = os.path.join(folder_path, 'transcripts.json')
                            if os.path.exists(json_path):
                                try:
                                    with open(json_path, 'r') as f:
                                        data = json.load(f)
                                        
                                        for item in data:
                                            module_data['content_items'].append({
                                                'file': item.get('filename'),
                                                'name': item.get('name'),
                                                'transcript': item.get('transcript')
                                            })
                                except Exception as e:
                                    print(f"Error reading transcripts.json for {folder_name}: {e}")
                                    # Fallback or show error? Currently just empty list if fails.
                        
                        modules.append(module_data)

    return render_template('list_modules.html', modules=modules)

@app.route('/trainer/api/modules_status')
def get_modules_status():
    if session.get('role') != 'trainer':
        return jsonify({'error': 'Unauthorized'}), 401
        
    current_user = session.get('username')
    statuses = {}
    
    modules_folder = app.config['MODULES_FOLDER']
    if os.path.exists(modules_folder):
        for folder_name in os.listdir(modules_folder):
            folder_path = os.path.join(modules_folder, folder_name)
            
            if os.path.isdir(folder_path):
                trainer_file = os.path.join(folder_path, 'trainer.txt')
                status_file = os.path.join(folder_path, 'status.txt')
                
                if os.path.exists(trainer_file):
                    with open(trainer_file, 'r') as f:
                        owner = f.read().strip()
                    
                    if owner == current_user:
                        status = "UNKNOWN"
                        if os.path.exists(status_file):
                            with open(status_file, 'r') as f:
                                status = f.read().strip()
                        statuses[folder_name] = status
                        
    return jsonify(statuses)

@app.route('/trainer/delete_module/<module_code>', methods=['POST'])
def delete_module(module_code):
    if session.get('role') != 'trainer':
        return jsonify({'error': 'Unauthorized'}), 401
    
    # Use helper for validation
    if not is_valid_module_code(module_code):
        return jsonify({'error': 'Invalid module code format'}), 400
    
    # Sanitize inputs (although is_valid_module_code makes this redundant, secure_filename is nice to keep)
    safe_code = secure_filename(module_code)
    module_path = os.path.join(app.config['MODULES_FOLDER'], safe_code)
    
    if not os.path.exists(module_path):
        return jsonify({'error': 'Module not found'}), 404
        
    # Verify ownership
    trainer_file = os.path.join(module_path, 'trainer.txt')
    current_user = session.get('username')
    
    if not os.path.exists(trainer_file):
        return jsonify({'error': 'Invalid module'}), 400
        
    with open(trainer_file, 'r') as f:
        owner = f.read().strip()
        
    if owner != current_user:
        return jsonify({'error': 'Permission denied'}), 403
        
    try:
        shutil.rmtree(module_path)
        return jsonify({'success': True})
    except Exception as e:
        print(f"Error deleting module {safe_code}: {e}")
        return jsonify({'error': str(e)}), 500

from src.utils.qr_generator import generate_module_qr_zip

@app.route('/trainer/download_qr/<module_code>')
def download_qr(module_code):
    if session.get('role') != 'trainer':
        return redirect(url_for('login_trainer'))
    
    # Use helper for validation
    if not is_valid_module_code(module_code):
        abort(400, description="Invalid module code")
        
    safe_code = secure_filename(module_code)
    module_path = os.path.join(app.config['MODULES_FOLDER'], safe_code)
    
    if not os.path.exists(module_path):
        abort(404, description="Module not found")
        
    # Verify ownership
    trainer_file = os.path.join(module_path, 'trainer.txt')
    current_user = session.get('username')
    
    if not os.path.exists(trainer_file):
        abort(400, description="Invalid module integrity")
        
    with open(trainer_file, 'r') as f:
        owner = f.read().strip()
        
    if owner != current_user:
        abort(403, description="Permission denied")
        
    # Get Module Name for filename
    name_file = os.path.join(module_path, 'name.txt')
    module_name = "module"
    if os.path.exists(name_file):
        with open(name_file, 'r') as f:
            module_name = f.read().strip()
            
    safe_download_name = f"{secure_filename(module_name)}-qr.zip"
    
    try:
        zip_buffer = generate_module_qr_zip(module_path)
        return send_file(
            zip_buffer,
            mimetype='application/zip',
            as_attachment=True,
            download_name=safe_download_name
        )
    except Exception as e:
        print(f"Error generating QR zip: {e}")
        return f"Error generation QR codes: {str(e)}", 500

def run_server(host='0.0.0.0', port=80):
    """Run the Flask server"""
    print(f"Starting AeroAR Flask application on port {port}...")
    # debug flag is set via env vars
    app.run(host=host, port=port)
