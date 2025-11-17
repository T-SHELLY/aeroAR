# AeroAR Flask Application

QR code scanner application with Flask backend.

## Project Structure

```
aeroAR/
├── main.py              # Flask application entry point
├── templates/           # HTML templates
│   ├── index.html      # Main landing page
│   ├── scan.html       # QR code scanner page
│   ├── credits.html    # Credits page
│   └── previous.html   # Previous scans page
├── static/             # Static assets
│   ├── css/           # Stylesheets
│   │   ├── styles.css # Global styles
│   │   └── scan.css   # Scanner-specific styles
│   └── js/            # JavaScript files
│       └── scan.js    # QR scanner logic
├── audios/            # Audio files directory
└── requirements.txt   # Python dependencies
```

## Setup

1. **Create virtual environment** (using uv):
   ```bash
   uv venv
   ```

2. **Install dependencies**:
   ```bash
   uv pip install -r requirements.txt
   ```

3. **Run the application**:
   ```bash
   source .venv/bin/activate
   python main.py
   ```

   Or use the run script:
   ```bash
   ./run.sh
   ```

4. **Access the application**:
   Open your browser to `http://localhost:9999`

## API Endpoints

### `GET /`
Main landing page

### `GET /scan`
QR code scanner page

### `GET /audios`
Audio endpoint that receives QR code data

**Parameters:**
- `name` (string): QR code content or identifier

**Example:**
```
GET /audios?name=qr_code_123
```

**Response:**
```json
{
  "status": "success",
  "name": "qr_code_123",
  "message": "Audio request received for: qr_code_123"
}
```

## Features

- **QR Code Scanner**: Uses device camera to scan QR codes
- **Toast Notifications**: Error messages slide in from top
- **Responsive Design**: Works on mobile and desktop
- **Auto Camera Selection**: Prefers back camera on mobile devices
- **Dynamic Resize**: Camera adjusts to window size changes

## Development

The Flask app runs in debug mode by default on port 9999. The server will auto-reload when you make changes to Python files.

To change the port, edit `main.py`:
```python
app.run(host='0.0.0.0', port=YOUR_PORT, debug=True)
```
