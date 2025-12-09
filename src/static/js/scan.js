// QR Code Scan functionality
let html5QrCode;
let isScanning = false;
let currentAudio = null;
let audioBlob = null;
let audioName = '';
let cameraAvailable = false;
let currentCameraId = null;

// Configuration for the QR scanner - scans entire frame
const config = {
    fps: 10,
    aspectRatio: 1.0
};

// Function to update mode label
function updateModeLabel(mode) {
    const modeLabel = document.getElementById('modeLabel');
    if (modeLabel) {
        modeLabel.textContent = mode;
    }
}

// Function to show/hide camera toggle
function setCameraToggleVisibility(visible) {
    const toggleContainer = document.getElementById('cameraToggleContainer');
    if (toggleContainer) {
        toggleContainer.style.display = visible ? 'flex' : 'none';
    }
}

// Function to stop camera scanning
async function stopCamera() {
    if (html5QrCode && html5QrCode.getState() === 2) { // State 2 = SCANNING
        try {
            await html5QrCode.stop();
            document.getElementById('statusMessage').innerHTML =
                '<span class="info">Camera disabled. Watch Scan mode active.</span>';
            updateModeLabel('Watch Scan');

            // Update result text for Watch Mode
            document.getElementById('resultText').innerHTML = 'Watch Mode Active';

            // Show Camera Off Placeholder
            const placeholder = document.getElementById('cameraOffPlaceholder');
            if (placeholder) placeholder.style.display = 'flex';

        } catch (err) {
            console.error('Error stopping camera:', err);
        }
    }
}

// Function to start camera scanning
async function startCamera() {
    if (!currentCameraId || !html5QrCode) return;

    try {
        await html5QrCode.start(
            currentCameraId,
            config,
            onScanSuccess,
            onScanError
        );
        document.getElementById('statusMessage').innerHTML =
            '<span class="success">Camera ready! Point at a QR code</span>';
        updateModeLabel('QR + Watch Scan');

        // Restore result text for Camera Mode
        document.getElementById('resultText').innerHTML = 'Point camera at a QR code';

        // Hide Camera Off Placeholder
        const placeholder = document.getElementById('cameraOffPlaceholder');
        if (placeholder) placeholder.style.display = 'none';

        // Adjust reader size to match camera feed after a short delay
        setTimeout(adjustReaderSize, 500);
    } catch (err) {
        console.error('Error starting camera:', err);
        showToast(`Error starting camera: ${err}`, 'error');
        document.getElementById('statusMessage').innerHTML =
            `<span class="error">Error starting camera: ${err}</span>`;

        // Ensure placeholder is shown if camera fails
        const placeholder = document.getElementById('cameraOffPlaceholder');
        if (placeholder) placeholder.style.display = 'flex';
    }
}

// Helper function to show toast notifications
function showToast(message, type = 'info', duration = 3000) {
    const classNames = {
        error: 'toast-error',
        success: 'toast-success',
        info: 'toast-info'
    };

    Toastify({
        text: message,
        duration: duration,
        gravity: 'top',
        position: 'center',
        stopOnFocus: true,
        className: classNames[type] || classNames.info,
        onClick: function () { } // Callback after click
    }).showToast();
}

// Function to adjust reader div to match actual camera feed size
function adjustReaderSize() {
    const readerDiv = document.getElementById('reader');
    const video = readerDiv.querySelector('video');

    if (video) {
        // Force the video to cover the container
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'cover';
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
    document.getElementById('audioPlayerBar').style.display = 'flex';

    // Hide Status Card to prevent overlap
    const statusCard = document.getElementById('statusCard');
    if (statusCard) statusCard.style.display = 'none';

    // Hide mode controls when audio is playing
    const modeControls = document.getElementById('modeControls');
    if (modeControls) {
        modeControls.style.display = 'none';
    }

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
            playPauseBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>'; // Pause Icon
        } else {
            currentAudio.pause();
            playPauseBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>'; // Play Icon
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
        playPauseBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
    };

    currentAudio.onpause = () => {
        playPauseBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
    };
}

// Remove audio player
function removeAudioPlayer() {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    document.getElementById('audioPlayerBar').style.display = 'none';

    // Show Status Card again
    const statusCard = document.getElementById('statusCard');
    if (statusCard) statusCard.style.display = 'block';

    audioBlob = null;
    audioName = '';

    // Show mode controls again when audio stops
    const modeControls = document.getElementById('modeControls');
    if (modeControls) {
        modeControls.style.display = 'flex';
    }

    // Resume scanning only if camera toggle is enabled and camera is available
    const cameraToggle = document.getElementById('cameraToggle');
    if (html5QrCode && cameraAvailable && cameraToggle && cameraToggle.checked) {
        isScanning = false;
        html5QrCode.resume();
        document.getElementById('statusMessage').innerHTML =
            '<span class="info">Ready to scan next QR code...</span>';
    }
}

// Format time in MM:SS
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Easter egg function to simulate watch connection
function triggerWatchEasterEgg() {
    // Show initial toast notification (2 seconds)
    showToast('Showing watch connect in 10 seconds', 'info', 2000);

    // Wait 10 seconds, then trigger the oil-filter audio
    setTimeout(async () => {
        // Pause scanning only if camera is actively scanning
        if (html5QrCode && html5QrCode.getState() === 2) { // State 2 = SCANNING
            html5QrCode.pause(true);
            isScanning = true;
        }

        try {
            // Fetch the oil-filter audio
            const response = await fetch('/audios?name=oil-filter');

            if (!response.ok) {
                throw new Error(`Audio not found: ${response.status}`);
            }

            // Get the audio file as a blob
            audioBlob = await response.blob();
            audioName = 'oil-filter';

            // Show custom modal with watch message
            const modal = document.getElementById('audioConfirmModal');
            const modalText = modal.querySelector('p');
            const audioNameElement = document.getElementById('audioName');

            // Store original text to restore later
            const originalText = modalText.innerHTML;

            // Set custom watch message
            modalText.innerHTML = 'Read <strong>oil-filter</strong> from watch!';

            // Show the modal
            modal.style.display = 'flex';

            // Restore original text when modal is closed
            const restoreModalText = () => {
                modalText.innerHTML = originalText;
            };

            // Add one-time listeners to restore text
            document.getElementById('playYesBtn').addEventListener('click', restoreModalText, { once: true });
            document.getElementById('playNoBtn').addEventListener('click', restoreModalText, { once: true });

        } catch (error) {
            console.error('Easter egg error:', error);
            showToast('Failed to connect to watch', 'error');

            // Resume scanning on error only if it was scanning before
            if (html5QrCode && isScanning) {
                isScanning = false;
                html5QrCode.resume();
            }
        }
    }, 10000); // 10 seconds delay
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

        // Resume scanning only if camera is enabled
        const cameraToggle = document.getElementById('cameraToggle');
        if (html5QrCode && cameraAvailable && cameraToggle && cameraToggle.checked) {
            isScanning = false;
            html5QrCode.resume();
            document.getElementById('statusMessage').innerHTML =
                '<span class="info">Ready to scan next QR code...</span>';
        }
    };

    // Easter egg: Triple-click the back button to simulate watch connection
    const backButton = document.getElementById('bbutton');
    let clickCount = 0;
    let clickTimer = null;

    if (backButton) {
        backButton.addEventListener('click', (e) => {
            e.preventDefault(); // Always prevent default navigation
            clickCount++;

            if (clickCount === 1) {
                clickTimer = setTimeout(() => {
                    // If only single click, navigate after delay
                    if (clickCount === 1) {
                        window.location.href = 'index.html';
                    }
                    clickCount = 0;
                }, 600); // 600ms window for triple-click
            } else if (clickCount === 3) {
                // Triple click detected!
                clearTimeout(clickTimer);
                clickCount = 0;
                triggerWatchEasterEgg();
            }
        });
    }

    // Camera toggle handler
    const cameraToggle = document.getElementById('cameraToggle');
    if (cameraToggle) {
        cameraToggle.addEventListener('change', async (e) => {
            if (e.target.checked) {
                // Enable camera
                await startCamera();
            } else {
                // Disable camera
                await stopCamera();
            }
        });
    }
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

            // Store camera ID and mark as available
            currentCameraId = cameraId;
            cameraAvailable = true;
            setCameraToggleVisibility(true);

            html5QrCode.start(
                cameraId,
                config,
                onScanSuccess,
                onScanError
            ).then(() => {
                document.getElementById('statusMessage').innerHTML =
                    '<span class="success">Camera ready! Point at a QR code</span>';
                updateModeLabel('QR + Watch Scan');

                // Ensure checkbox is checked when camera starts successfully
                const cameraToggle = document.getElementById('cameraToggle');
                if (cameraToggle) {
                    cameraToggle.checked = true;
                }

                // Adjust reader size to match camera feed after a short delay
                setTimeout(adjustReaderSize, 500);
            }).catch(err => {
                console.error('Unable to start scanning', err);
                showToast(`Error starting camera: ${err}`, 'error');
                document.getElementById('statusMessage').innerHTML =
                    `<span class="error">Error starting camera: ${err}</span>`;

                // Camera permission denied - Watch Scan mode only
                cameraAvailable = false;
                setCameraToggleVisibility(false);
                updateModeLabel('Watch Scan');
            });
        } else {
            // No cameras found - Watch Scan mode only
            showToast('No cameras found on this device', 'error');
            document.getElementById('statusMessage').innerHTML =
                '<span class="error">No cameras found on this device</span>';
            cameraAvailable = false;
            setCameraToggleVisibility(false);
            updateModeLabel('Watch Scan');
        }
    }).catch(err => {
        // Camera permission denied or error - Watch Scan mode only
        console.error('Error getting cameras', err);
        showToast('Error accessing camera. Please grant camera permissions.', 'error');
        document.getElementById('statusMessage').innerHTML =
            '<span class="error">Error accessing camera. Please grant camera permissions.</span>';
        cameraAvailable = false;
        setCameraToggleVisibility(false);
        updateModeLabel('Watch Scan');
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
