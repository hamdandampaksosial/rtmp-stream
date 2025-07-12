const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const bodyParser = require('body-parser');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Global variables for stream management
let streamingProcess = null;
let isStreaming = false;
let streamConfig = {
  inputUrl: 'rtmp://localhost:1935/live/stream',
  youtubeUrl: '',
  youtubeKey: ''
};

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send current streaming status to new client
  socket.emit('streamStatus', {
    isStreaming,
    config: streamConfig
  });

  // Handle YouTube configuration
  socket.on('setYouTubeConfig', (config) => {
    streamConfig.youtubeUrl = config.url;
    streamConfig.youtubeKey = config.key;
    console.log('YouTube config updated:', config);
    socket.emit('configUpdated', 'YouTube configuration saved');
  });

  // Handle start streaming
  socket.on('startStream', () => {
    if (!isStreaming && streamConfig.youtubeUrl && streamConfig.youtubeKey) {
      startYouTubeStream();
      socket.emit('streamStarted', 'Stream started successfully');
      io.emit('streamStatus', { isStreaming: true, config: streamConfig });
    } else if (isStreaming) {
      socket.emit('error', 'Stream is already running');
    } else {
      socket.emit('error', 'Please configure YouTube RTMP URL and key first');
    }
  });

  // Handle stop streaming
  socket.on('stopStream', () => {
    if (isStreaming) {
      stopYouTubeStream();
      socket.emit('streamStopped', 'Stream stopped successfully');
      io.emit('streamStatus', { isStreaming: false, config: streamConfig });
    } else {
      socket.emit('error', 'No stream is currently running');
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Start YouTube streaming using ffmpeg
function startYouTubeStream() {
  const outputUrl = `${streamConfig.youtubeUrl}/${streamConfig.youtubeKey}`;
  
  streamingProcess = ffmpeg(streamConfig.inputUrl)
    .inputOptions([
      '-re',  // Read input at its native frame rate
      '-fflags', 'nobuffer',
      '-flags', 'low_delay',
      '-strict', 'experimental'
    ])
    .outputOptions([
      '-c:v', 'libx264',          // Video codec
      '-preset', 'veryfast',      // Encoding preset
      '-maxrate', '2500k',        // Max bitrate
      '-bufsize', '5000k',        // Buffer size
      '-vf', 'scale=1280:720',    // Scale to 720p
      '-g', '50',                 // GOP size
      '-r', '25',                 // Frame rate
      '-c:a', 'aac',              // Audio codec
      '-b:a', '128k',             // Audio bitrate
      '-ac', '2',                 // Audio channels
      '-ar', '44100',             // Audio sample rate
      '-f', 'flv'                 // Output format
    ])
    .output(outputUrl)
    .on('start', (commandLine) => {
      console.log('FFmpeg started with command:', commandLine);
      isStreaming = true;
      io.emit('streamStatus', { isStreaming: true, config: streamConfig });
    })
    .on('error', (err) => {
      console.error('FFmpeg error:', err);
      isStreaming = false;
      io.emit('streamError', err.message);
      io.emit('streamStatus', { isStreaming: false, config: streamConfig });
    })
    .on('end', () => {
      console.log('FFmpeg process ended');
      isStreaming = false;
      io.emit('streamStatus', { isStreaming: false, config: streamConfig });
    })
    .run();
}

// Stop YouTube streaming
function stopYouTubeStream() {
  if (streamingProcess) {
    streamingProcess.kill('SIGTERM');
    streamingProcess = null;
    isStreaming = false;
    console.log('Streaming stopped');
  }
}

// API Routes
app.get('/api/status', (req, res) => {
  res.json({
    isStreaming,
    config: streamConfig
  });
});

app.post('/api/config', (req, res) => {
  const { youtubeUrl, youtubeKey } = req.body;
  streamConfig.youtubeUrl = youtubeUrl;
  streamConfig.youtubeKey = youtubeKey;
  res.json({ message: 'Configuration updated successfully' });
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  if (streamingProcess) {
    streamingProcess.kill('SIGTERM');
  }
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  if (streamingProcess) {
    streamingProcess.kill('SIGTERM');
  }
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`RTMP YouTube Controller running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser`);
});