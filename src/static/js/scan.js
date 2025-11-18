// QR Code Scan functionality
let html5QrCode;
let isScanning = false;
let currentAudio = null;
let audioBlob = null;
let audioName = '';

// Configuration for the QR scanner - scans entire frame
const config = {
    fps: 10,
    aspectRatio: 1.0
};

// Helper function to show toast notifications
function showToast(message, type = 'info') {
    const backgrounds = {
        error: 'linear-gradient(to right, #4a5568, #2d3748)',  // Dark blue-gray for errors
        success: 'linear-gradient(to right, #3a7bd5, #00d2ff)', // Blue gradient for success
        info: 'linear-gradient(to right, #00d2ff, #3a7bd5)'     // Light to dark blue for info
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
        // Send GET request to /audios endpoint with QR code data as query parameter
        const response = await fetch(`/audios?name=${encodeURIComponent(qrCodeData)}`);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Audio not found: ${response.status}`);
        }

        // Get the audio file as a blob
        audioBlob = await response.blob();
        audioName = qrCodeData;

        // Show success toast
        showToast(`✓ Audio file received!`, 'success');

        document.getElementById('statusMessage').innerHTML =
            '<span class="success">Audio file received!</span>';

        // Show confirmation modal
        showAudioConfirmModal(qrCodeData);

    } catch (error) {
        console.error('Error fetching audio:', error);

        // Show error toast
        showToast(`Failed to fetch audio: ${error.message}`, 'error');

        document.getElementById('statusMessage').innerHTML =
            '<span class="error">Failed to fetch audio</span>';

        // Resume scanning after 2 seconds on error
        setTimeout(() => {
            isScanning = false;
            html5QrCode.resume();
            document.getElementById('statusMessage').innerHTML =
                '<span class="info">Ready to scan next QR code...</span>';
        }, 2000);
    }
}

// Show confirmation modal
function showAudioConfirmModal(name) {
    const modal = document.getElementById('audioConfirmModal');
    const audioNameElement = document.getElementById('audioName');

    audioNameElement.textContent = name;
    modal.style.display = 'flex';
}

// Hide confirmation modal
function hideAudioConfirmModal() {
    const modal = document.getElementById('audioConfirmModal');
    modal.style.display = 'none';
}

// Initialize audio player
function initializeAudioPlayer() {
    if (!audioBlob) return;

    // Clean up existing audio if any
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    // Create new audio element from blob
    const audioUrl = URL.createObjectURL(audioBlob);
    currentAudio = new Audio(audioUrl);

    // Set up audio title
    document.getElementById('audioTitle').textContent = audioName;

    // Show player bar
    document.getElementById('audioPlayerBar').style.display = 'block';

    // Set up event listeners
    setupAudioControls();

    // Auto-play
    currentAudio.play().catch(err => {
        console.error('Error playing audio:', err);
        showToast('Failed to play audio', 'error');
    });
}

// Set up audio control event listeners
function setupAudioControls() {
    const playPauseBtn = document.getElementById('playPauseBtn');
    const progressBar = document.getElementById('audioProgress');
    const removeBtn = document.getElementById('removeAudioBtn');
    const timeDisplay = document.getElementById('audioTime');

    // Play/Pause button
    playPauseBtn.onclick = () => {
        if (currentAudio.paused) {
            currentAudio.play();
            playPauseBtn.textContent = '⏸';
        } else {
            currentAudio.pause();
            playPauseBtn.textContent = '▶';
        }
    };

    // Progress bar update
    currentAudio.ontimeupdate = () => {
        const progress = (currentAudio.currentTime / currentAudio.duration) * 100;
        progressBar.value = progress;

        // Update time display
        const current = formatTime(currentAudio.currentTime);
        const total = formatTime(currentAudio.duration);
        timeDisplay.textContent = `${current} / ${total}`;
    };

    // Progress bar seek
    progressBar.oninput = (e) => {
        const seekTime = (e.target.value / 100) * currentAudio.duration;
        currentAudio.currentTime = seekTime;
    };

    // Remove button
    removeBtn.onclick = removeAudioPlayer;

    // Auto-remove when audio ends
    currentAudio.onended = () => {
        showToast('Audio finished playing', 'info');
        removeAudioPlayer();
    };

    // Update play button state
    currentAudio.onplay = () => {
        playPauseBtn.textContent = '⏸';
    };

    currentAudio.onpause = () => {
        playPauseBtn.textContent = '▶';
    };
}

// Remove audio player
function removeAudioPlayer() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    document.getElementById('audioPlayerBar').style.display = 'none';
    audioBlob = null;
    audioName = '';

    // Resume scanning
    isScanning = false;
    html5QrCode.resume();
    document.getElementById('statusMessage').innerHTML =
        '<span class="info">Ready to scan next QR code...</span>';
}

// Format time in MM:SS
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Handle modal button clicks
document.addEventListener('DOMContentLoaded', () => {
    // Yes button - play audio
    document.getElementById('playYesBtn').onclick = () => {
        hideAudioConfirmModal();
        initializeAudioPlayer();
    };

    // No button - close modal and resume scanning
    document.getElementById('playNoBtn').onclick = () => {
        hideAudioConfirmModal();
        audioBlob = null;
        audioName = '';

        // Resume scanning
        isScanning = false;
        html5QrCode.resume();
        document.getElementById('statusMessage').innerHTML =
            '<span class="info">Ready to scan next QR code...</span>';
    };
});

// Start the QR code scanner
function startScanner() {
    html5QrCode = new Html5Qrcode("reader");

    // Request camera permissions and start scanning
    Html5Qrcode.getCameras().then(devices => {
        if (devices && devices.length) {
            // Find the back camera (environment facing) for better QR scanning
            let cameraId = devices[0].id; // Default to first camera

            // Look for back camera
            const backCamera = devices.find(device => {
                const label = device.label.toLowerCase();
                return label.includes('back') ||
                       label.includes('rear') ||
                       label.includes('environment');
            });

            if (backCamera) {
                cameraId = backCamera.id;
                console.log('Using back camera:', backCamera.label);
            } else {
                console.log('Back camera not found, using:', devices[0].label);
            }

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
