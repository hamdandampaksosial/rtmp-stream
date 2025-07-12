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
  inputUrl: process.env.RTMP_INPUT_URL || 'rtmp://localhost:1935/live/stream',
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
  socket.on('startStream', async () => {
    if (!isStreaming && streamConfig.youtubeUrl && streamConfig.youtubeKey) {
      try {
        await startYouTubeStream();
        socket.emit('streamStarted', 'Stream started successfully');
      } catch (error) {
        socket.emit('error', `Failed to start stream: ${error.message}`);
      }
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

// Function to check if RTMP input is available
function checkRtmpInput() {
  return new Promise((resolve, reject) => {
    const testProcess = ffmpeg(streamConfig.inputUrl)
      .inputOptions([
        '-t', '1',  // Test for 1 second
        '-f', 'null'
      ])
      .output('-')
      .on('start', () => {
        console.log('Testing RTMP input connection...');
      })
      .on('end', () => {
        console.log('RTMP input is available');
        resolve(true);
      })
      .on('error', (err) => {
        console.error('RTMP input test failed:', err.message);
        reject(err);
      })
      .run();
      
    // Timeout after 10 seconds
    setTimeout(() => {
      testProcess.kill('SIGKILL');
      reject(new Error('RTMP input test timeout'));
    }, 10000);
  });
}

// Start YouTube streaming using ffmpeg
async function startYouTubeStream() {
  const outputUrl = `${streamConfig.youtubeUrl}/${streamConfig.youtubeKey}`;
  
  try {
    // Check if RTMP input is available
    await checkRtmpInput();
    console.log('RTMP input verified, starting stream...');
  } catch (error) {
    const errorMsg = `RTMP input not available: ${error.message}. Please check:\n` +
                    `1. nginx-rtmp server is running\n` +
                    `2. Stream is being sent to ${streamConfig.inputUrl}\n` +
                    `3. No firewall blocking port 1935`;
    console.error(errorMsg);
    io.emit('streamError', errorMsg);
    return;
  }
  
  streamingProcess = ffmpeg(streamConfig.inputUrl)
    .inputOptions([
      '-re',  // Read input at its native frame rate
      '-fflags', 'nobuffer',
      '-flags', 'low_delay',
      '-strict', 'experimental',
      '-timeout', '10000000'  // 10 second timeout
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
      
      let errorMessage = err.message;
      if (err.message.includes('Connection refused')) {
        errorMessage = 'Cannot connect to RTMP input. Please check if nginx-rtmp is running and stream is active.';
      } else if (err.message.includes('No such file or directory')) {
        errorMessage = 'FFmpeg not found. Please install FFmpeg.';
      }
      
      io.emit('streamError', errorMessage);
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

// Check RTMP input status
app.get('/api/rtmp-status', async (req, res) => {
  try {
    await checkRtmpInput();
    res.json({ 
      status: 'available', 
      inputUrl: streamConfig.inputUrl,
      message: 'RTMP input is available' 
    });
  } catch (error) {
    res.status(503).json({ 
      status: 'unavailable', 
      inputUrl: streamConfig.inputUrl,
      error: error.message,
      suggestions: [
        'Check if nginx-rtmp server is running',
        'Verify stream is being sent to ' + streamConfig.inputUrl,
        'Check firewall settings for port 1935',
        'Ensure nginx RTMP module is properly configured'
      ]
    });
  }
});

// System health check
app.get('/api/health', (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      nodejs: 'running',
      ffmpeg: null,
      rtmp: null
    },
    config: {
      inputUrl: streamConfig.inputUrl,
      hasYouTubeConfig: !!(streamConfig.youtubeUrl && streamConfig.youtubeKey)
    }
  };

  // Check FFmpeg
  try {
    require('child_process').execSync('ffmpeg -version', { stdio: 'ignore' });
    health.services.ffmpeg = 'available';
  } catch (error) {
    health.services.ffmpeg = 'missing';
    health.status = 'degraded';
  }

  res.json(health);
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