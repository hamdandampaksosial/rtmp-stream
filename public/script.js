// Socket.io connection
const socket = io();

// DOM elements
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const previewVideo = document.getElementById('previewVideo');
const previewOverlay = document.getElementById('previewOverlay');
const youtubeUrlInput = document.getElementById('youtubeUrl');
const youtubeKeyInput = document.getElementById('youtubeKey');
const configForm = document.getElementById('configForm');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const streamStatus = document.getElementById('streamStatus');
const streamDuration = document.getElementById('streamDuration');
const streamTarget = document.getElementById('streamTarget');
const logsContainer = document.getElementById('logsContainer');
const resolutionSpan = document.getElementById('resolution');
const bitrateSpan = document.getElementById('bitrate');

// Global variables
let isStreaming = false;
let streamStartTime = null;
let durationInterval = null;
let hls = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeVideoPreview();
    updateTimestamp();
    setInterval(updateTimestamp, 1000);
    
    // Load saved configuration from localStorage
    loadSavedConfig();
});

// Socket.io event handlers
socket.on('connect', () => {
    console.log('Connected to server');
    updateConnectionStatus(true);
    addLogEntry('Connected to server', 'success');
});

socket.on('disconnect', () => {
    console.log('Disconnected from server');
    updateConnectionStatus(false);
    addLogEntry('Disconnected from server', 'error');
});

socket.on('streamStatus', (data) => {
    console.log('Stream status received:', data);
    updateStreamStatus(data);
});

socket.on('configUpdated', (message) => {
    addLogEntry(message, 'info');
});

socket.on('streamStarted', (message) => {
    addLogEntry(message, 'success');
    startStreamTimer();
});

socket.on('streamStopped', (message) => {
    addLogEntry(message, 'info');
    stopStreamTimer();
});

socket.on('streamError', (error) => {
    addLogEntry(`Stream error: ${error}`, 'error');
    stopStreamTimer();
});

socket.on('error', (error) => {
    addLogEntry(`Error: ${error}`, 'error');
});

// Form submission handler
configForm.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const youtubeUrl = youtubeUrlInput.value.trim();
    const youtubeKey = youtubeKeyInput.value.trim();
    
    if (!youtubeUrl || !youtubeKey) {
        addLogEntry('Please fill in all YouTube configuration fields', 'error');
        return;
    }
    
    // Save configuration to localStorage
    saveConfig(youtubeUrl, youtubeKey);
    
    // Send configuration to server
    socket.emit('setYouTubeConfig', {
        url: youtubeUrl,
        key: youtubeKey
    });
    
    // Update UI
    streamTarget.textContent = youtubeUrl;
    startBtn.disabled = false;
    
    addLogEntry('YouTube configuration saved', 'success');
});

// Control button handlers
startBtn.addEventListener('click', () => {
    if (!isStreaming) {
        socket.emit('startStream');
        startBtn.disabled = true;
        stopBtn.disabled = false;
        addLogEntry('Starting stream...', 'info');
    }
});

stopBtn.addEventListener('click', () => {
    if (isStreaming) {
        socket.emit('stopStream');
        startBtn.disabled = false;
        stopBtn.disabled = true;
        addLogEntry('Stopping stream...', 'info');
    }
});

// Video preview initialization
function initializeVideoPreview() {
    const videoSrc = 'http://localhost:8080/live/stream.m3u8';
    
    if (Hls.isSupported()) {
        hls = new Hls({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 90
        });
        
        hls.loadSource(videoSrc);
        hls.attachMedia(previewVideo);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log('HLS manifest parsed, attempting to play');
            hidePreviewOverlay();
            previewVideo.play().catch(e => {
                console.log('Autoplay prevented:', e);
                showPreviewOverlay();
            });
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
            console.log('HLS error:', data);
            if (data.fatal) {
                showPreviewOverlay();
                addLogEntry('Preview stream error: ' + data.details, 'warning');
            }
        });
        
        hls.on(Hls.Events.LEVEL_LOADED, (event, data) => {
            updateVideoInfo(data);
        });
        
    } else if (previewVideo.canPlayType('application/vnd.apple.mpegurl')) {
        previewVideo.src = videoSrc;
        previewVideo.addEventListener('loadedmetadata', () => {
            hidePreviewOverlay();
        });
        previewVideo.addEventListener('error', () => {
            showPreviewOverlay();
        });
    } else {
        addLogEntry('HLS not supported in this browser', 'warning');
        showPreviewOverlay();
    }
    
    // Try to play video every 10 seconds if overlay is showing
    setInterval(() => {
        if (!previewOverlay.classList.contains('hidden')) {
            if (hls) {
                hls.startLoad();
            }
        }
    }, 10000);
}

// Update video information
function updateVideoInfo(data) {
    if (data.details && data.details.totalduration) {
        const resolution = `${data.details.width || 'N/A'}x${data.details.height || 'N/A'}`;
        const bitrate = data.details.bitrate ? `${Math.round(data.details.bitrate / 1000)}kbps` : 'N/A';
        
        resolutionSpan.textContent = resolution;
        bitrateSpan.textContent = bitrate;
    }
}

// Preview overlay functions
function showPreviewOverlay() {
    previewOverlay.classList.remove('hidden');
}

function hidePreviewOverlay() {
    previewOverlay.classList.add('hidden');
}

// Connection status update
function updateConnectionStatus(connected) {
    if (connected) {
        statusDot.className = 'status-dot connected';
        statusText.textContent = 'Connected';
    } else {
        statusDot.className = 'status-dot';
        statusText.textContent = 'Disconnected';
    }
}

// Stream status update
function updateStreamStatus(data) {
    isStreaming = data.isStreaming;
    
    if (isStreaming) {
        statusDot.className = 'status-dot streaming';
        statusText.textContent = 'Streaming';
        streamStatus.textContent = 'Live';
        startBtn.disabled = true;
        stopBtn.disabled = false;
    } else {
        statusDot.className = 'status-dot connected';
        statusText.textContent = 'Connected';
        streamStatus.textContent = 'Ready';
        startBtn.disabled = !data.config.youtubeUrl || !data.config.youtubeKey;
        stopBtn.disabled = true;
    }
    
    // Update target display
    if (data.config.youtubeUrl) {
        streamTarget.textContent = data.config.youtubeUrl;
    }
}

// Stream timer functions
function startStreamTimer() {
    streamStartTime = new Date();
    durationInterval = setInterval(updateStreamDuration, 1000);
}

function stopStreamTimer() {
    if (durationInterval) {
        clearInterval(durationInterval);
        durationInterval = null;
    }
    streamStartTime = null;
    streamDuration.textContent = '00:00:00';
}

function updateStreamDuration() {
    if (streamStartTime) {
        const now = new Date();
        const diff = now - streamStartTime;
        const hours = Math.floor(diff / 3600000);
        const minutes = Math.floor((diff % 3600000) / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        
        streamDuration.textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Logging functions
function addLogEntry(message, type = 'info') {
    const logEntry = document.createElement('div');
    logEntry.className = `log-entry ${type}`;
    
    const timestamp = document.createElement('span');
    timestamp.className = 'timestamp';
    timestamp.textContent = new Date().toLocaleTimeString();
    
    const messageSpan = document.createElement('span');
    messageSpan.className = 'message';
    messageSpan.textContent = message;
    
    logEntry.appendChild(timestamp);
    logEntry.appendChild(messageSpan);
    
    logsContainer.appendChild(logEntry);
    logsContainer.scrollTop = logsContainer.scrollHeight;
    
    // Keep only last 100 log entries
    while (logsContainer.children.length > 100) {
        logsContainer.removeChild(logsContainer.firstChild);
    }
}

// Configuration persistence
function saveConfig(url, key) {
    localStorage.setItem('youtube_url', url);
    localStorage.setItem('youtube_key', key);
}

function loadSavedConfig() {
    const savedUrl = localStorage.getItem('youtube_url');
    const savedKey = localStorage.getItem('youtube_key');
    
    if (savedUrl) {
        youtubeUrlInput.value = savedUrl;
        streamTarget.textContent = savedUrl;
    }
    
    if (savedKey) {
        youtubeKeyInput.value = savedKey;
    }
    
    // Enable start button if both values are present
    if (savedUrl && savedKey) {
        startBtn.disabled = false;
    }
}

// Update timestamp in logs
function updateTimestamp() {
    const entries = document.querySelectorAll('.log-entry .timestamp');
    entries.forEach(entry => {
        if (entry.textContent === '') {
            entry.textContent = new Date().toLocaleTimeString();
        }
    });
}

// Cleanup function
window.addEventListener('beforeunload', () => {
    if (hls) {
        hls.destroy();
    }
    if (durationInterval) {
        clearInterval(durationInterval);
    }
});

// Error handling
window.addEventListener('error', (e) => {
    addLogEntry(`JavaScript error: ${e.message}`, 'error');
});

// Initial log entry
addLogEntry('Application initialized', 'info');