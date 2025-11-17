// QR Code Scan functionality
let html5QrCode;
let isScanning = false;

// Configuration for the QR scanner - scans entire frame
const config = {
    fps: 10,
    aspectRatio: 1.0
};

// Helper function to show toast notifications
function showToast(message, type = 'info') {
    const backgrounds = {
        error: 'linear-gradient(to right, #ff5f6d, #ffc371)',
        success: 'linear-gradient(to right, #00b09b, #96c93d)',
        info: 'linear-gradient(to right, #00d2ff, #3a7bd5)'
    };

    Toastify({
        text: message,
        duration: 3000,
        gravity: 'top',
        position: 'center',
        stopOnFocus: true,
        style: {
            background: backgrounds[type] || backgrounds.info,
        },
        onClick: function(){} // Callback after click
    }).showToast();
}

// Function to adjust reader div to match actual camera feed size
function adjustReaderSize() {
    const readerDiv = document.getElementById('reader');
    const video = readerDiv.querySelector('video');

    if (video && video.videoHeight > 0) {
        // Calculate the displayed height based on video aspect ratio
        const videoAspectRatio = video.videoWidth / video.videoHeight;
        const readerWidth = readerDiv.offsetWidth;
        const calculatedHeight = readerWidth / videoAspectRatio;

        // Only adjust if the camera feed is smaller than the container
        const currentHeight = readerDiv.offsetHeight;
        if (calculatedHeight < currentHeight) {
            readerDiv.style.height = `${calculatedHeight}px`;
        }
    }
}

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

        // Show error toast
        showToast(`Failed to fetch audio: ${error.message}`, 'error');

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

                // Adjust reader size to match camera feed after a short delay
                setTimeout(adjustReaderSize, 500);
            }).catch(err => {
                console.error('Unable to start scanning', err);
                showToast(`Error starting camera: ${err}`, 'error');
                document.getElementById('statusMessage').innerHTML =
                    `<span class="error">Error starting camera: ${err}</span>`;
            });
        } else {
            showToast('No cameras found on this device', 'error');
            document.getElementById('statusMessage').innerHTML =
                '<span class="error">No cameras found on this device</span>';
        }
    }).catch(err => {
        console.error('Error getting cameras', err);
        showToast('Error accessing camera. Please grant camera permissions.', 'error');
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

// Handle window resize to update camera dimensions
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        if (html5QrCode && html5QrCode.getState() === 2) { // State 2 = SCANNING
            const currentCameraId = html5QrCode.getRunningTrackCameraCapabilities()?.deviceId;

            // Show refreshing message
            document.getElementById('statusMessage').innerHTML =
                '<span class="info">Refreshing camera...</span>';

            html5QrCode.stop().then(() => {
                // Restart with the same camera
                if (currentCameraId) {
                    html5QrCode.start(currentCameraId, config, onScanSuccess, onScanError)
                        .then(() => {
                            document.getElementById('statusMessage').innerHTML =
                                '<span class="success">Camera ready! Point at a QR code</span>';

                            // Adjust reader size after restart
                            setTimeout(adjustReaderSize, 500);
                        })
                        .catch(err => {
                            console.error('Error restarting scanner after resize:', err);
                            showToast(`Error restarting camera: ${err}`, 'error');
                            document.getElementById('statusMessage').innerHTML =
                                `<span class="error">Error restarting camera: ${err}</span>`;
                        });
                } else {
                    startScanner();
                }
            }).catch(err => {
                console.error('Error stopping scanner for resize:', err);
                showToast(`Error stopping camera: ${err}`, 'error');
                document.getElementById('statusMessage').innerHTML =
                    `<span class="error">Error stopping camera: ${err}</span>`;
            });
        }
    }, 500); // Debounce resize events
});

// Start scanner when page loads
window.addEventListener('load', startScanner);
