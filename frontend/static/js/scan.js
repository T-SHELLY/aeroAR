// QR Code Scan functionality
let html5QrCode;
let isScanning = false;

// Configuration for the QR scanner - scans entire frame
const config = {
    fps: 10,
    aspectRatio: 1.0
};

// Function to handle successful QR code scan
function onScanSuccess(decodedText, decodedResult) {
    if (isScanning) {
        return; // Prevent multiple simultaneous scans
    }

    isScanning = true;
    console.log(`QR Code detected: ${decodedText}`, decodedResult);

    // Update result display
    document.getElementById('resultText').innerHTML = `
        <strong>QR Code Scanned:</strong><br>
        ${decodedText}
    `;

    // Update status
    document.getElementById('statusMessage').innerHTML =
        '<span class="success">QR Code detected! Fetching audio...</span>';

    // Pause scanning temporarily
    html5QrCode.pause(true);

    // Send GET request to /audio endpoint
    fetchAudio(decodedText);
}

// Function to handle scan errors (mostly just no QR code in frame)
function onScanError(errorMessage) {
    // Don't show errors for "No QR code found" - this is normal
    // Only log actual errors
    if (!errorMessage.includes('No MultiFormat Readers') &&
        !errorMessage.includes('NotFoundException')) {
        console.warn(`QR Scan error: ${errorMessage}`);
    }
}

// Function to fetch audio from backend
async function fetchAudio(qrCodeData) {
    try {
        // Send GET request to /audio endpoint with QR code data as query parameter
        const response = await fetch(`/audio?code=${encodeURIComponent(qrCodeData)}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Display the response
        const audioResponseDiv = document.getElementById('audioResponse');
        audioResponseDiv.style.display = 'block';
        audioResponseDiv.innerHTML = `
            <h4>Backend Response:</h4>
            <pre>${JSON.stringify(data, null, 2)}</pre>
        `;

        document.getElementById('statusMessage').innerHTML =
            '<span class="success">Audio data received successfully!</span>';

        // Resume scanning after 3 seconds
        setTimeout(() => {
            isScanning = false;
            html5QrCode.resume();
            document.getElementById('statusMessage').innerHTML =
                '<span class="info">Ready to scan next QR code...</span>';
        }, 3000);

    } catch (error) {
        console.error('Error fetching audio:', error);

        document.getElementById('statusMessage').innerHTML =
            `<span class="error">Error: ${error.message}</span>`;

        const audioResponseDiv = document.getElementById('audioResponse');
        audioResponseDiv.style.display = 'block';
        audioResponseDiv.innerHTML = `
            <h4>Error:</h4>
            <p>Failed to fetch audio data from backend.</p>
            <p>${error.message}</p>
        `;

        // Resume scanning after 3 seconds even on error
        setTimeout(() => {
            isScanning = false;
            html5QrCode.resume();
            document.getElementById('statusMessage').innerHTML =
                '<span class="info">Ready to scan next QR code...</span>';
        }, 3000);
    }
}

// Start the QR code scanner
function startScanner() {
    html5QrCode = new Html5Qrcode("reader");

    // Request camera permissions and start scanning
    Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
            // Use the back camera if available (better for QR scanning)
            const cameraId = devices.length > 1 ? devices[1].id : devices[0].id;

            html5QrCode.start(
                cameraId,
                config,
                onScanSuccess,
                onScanError
            ).then(() => {
                document.getElementById('statusMessage').innerHTML =
                    '<span class="success">Camera ready! Point at a QR code</span>';
            }).catch(err => {
                console.error('Unable to start scanning', err);
                document.getElementById('statusMessage').innerHTML =
                    `<span class="error">Error starting camera: ${err}</span>`;
            });
        } else {
            document.getElementById('statusMessage').innerHTML =
                '<span class="error">No cameras found on this device</span>';
        }
    }).catch(err => {
        console.error('Error getting cameras', err);
        document.getElementById('statusMessage').innerHTML =
            '<span class="error">Error accessing camera. Please grant camera permissions.</span>';
    });
}

// Cleanup when page is closed
window.addEventListener('beforeunload', () => {
    if (html5QrCode) {
        html5QrCode.stop().catch(err => console.error('Error stopping scanner:', err));
    }
});

// Start scanner when page loads
window.addEventListener('load', startScanner);
