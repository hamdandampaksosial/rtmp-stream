# RTMP YouTube Stream Controller

A modern web-based RTMP streaming controller that receives streams from nginx and forwards them to YouTube Live with real-time preview functionality.

## Features

- 🎥 **Live Stream Preview**: Real-time HLS preview of incoming RTMP streams
- 📺 **YouTube Integration**: Easy configuration and streaming to YouTube Live
- 🎛️ **Stream Controls**: Start/stop streaming with real-time status updates
- 📊 **Stream Monitoring**: Live statistics, duration tracking, and stream health monitoring
- 🔒 **Configuration Management**: Secure storage of YouTube credentials
- 📱 **Responsive Design**: Modern, mobile-friendly interface
- 📋 **Real-time Logs**: Live streaming logs and error reporting

## Architecture

```
[OBS/Encoder] → [nginx-rtmp] → [Preview (HLS)] → [Web Interface]
                     ↓
                [ffmpeg] → [YouTube Live]
```

## Quick Start with Docker

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd rtmp-youtube-controller
   ```

2. **Start the services:**
   ```bash
   docker-compose up -d
   ```

3. **Access the web interface:**
   - Open http://localhost:3000 in your browser
   - Configure your YouTube RTMP URL and stream key
   - Start streaming from OBS to `rtmp://localhost:1935/live/stream`

## Manual Installation

### Prerequisites

- Node.js 18+ 
- ffmpeg
- nginx with RTMP module

### Installation Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure nginx:**
   - Copy `nginx.conf` to your nginx configuration directory
   - Restart nginx: `sudo systemctl restart nginx`

3. **Start the application:**
   ```bash
   npm start
   ```

4. **Access the application:**
   - Open http://localhost:3000

## Configuration

### YouTube Live Setup

1. **Go to YouTube Studio:**
   - Navigate to YouTube Studio → Go Live → Stream
   - Copy the Stream URL (usually `rtmp://a.rtmp.youtube.com/live2`)
   - Copy the Stream Key (keep this secret!)

2. **Configure in the app:**
   - Enter the Stream URL and Stream Key in the YouTube Configuration section
   - Click "Save Configuration"

### OBS Studio Setup

1. **Add a streaming service:**
   - Settings → Stream
   - Service: Custom
   - Server: `rtmp://localhost:1935/live`
   - Stream Key: `stream`

2. **Configure video settings:**
   - Recommended: 1280x720, 30fps
   - Bitrate: 2500-4000 kbps for YouTube

## API Documentation

### REST Endpoints

- `GET /api/status` - Get current streaming status
- `POST /api/config` - Update YouTube configuration

### WebSocket Events

- `setYouTubeConfig` - Update YouTube RTMP configuration
- `startStream` - Start streaming to YouTube
- `stopStream` - Stop streaming
- `streamStatus` - Real-time stream status updates

## Environment Variables

- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)

## File Structure

```
├── server.js              # Main Node.js server
├── package.json           # Dependencies and scripts
├── public/
│   ├── index.html         # Main web interface
│   ├── styles.css         # Styling
│   └── script.js          # Frontend JavaScript
├── nginx.conf             # nginx RTMP configuration
├── docker-compose.yml     # Docker deployment
├── Dockerfile            # Container configuration
└── README.md             # This file
```

## Troubleshooting

### Common Issues

1. **Docker build fails with npm ci error:**
   - Make sure `package-lock.json` exists (run `npm install` first)
   - This has been fixed in the latest version

2. **No preview showing:**
   - Check if nginx is running and configured correctly
   - Verify RTMP stream is being sent to `rtmp://localhost:1935/live/stream`
   - Check browser console for HLS errors

3. **Stream won't start:**
   - Verify YouTube RTMP URL and stream key are correct
   - Check if ffmpeg is installed and accessible
   - Review server logs for error messages

4. **Permission denied errors:**
   - Ensure nginx has write permissions to `/tmp/hls` and `/tmp/recordings`
   - Check if ports 1935, 3000, and 8080 are available

### Debug Mode

Enable debug logging:
```bash
DEBUG=* npm start
```

### Log Files

- nginx logs: `/var/log/nginx/` (or `./logs/` with Docker)
- Application logs: Browser console and server output

## Security Considerations

⚠️ **Important**: This setup is for development/local use. For production:

1. **Change nginx security settings:**
   - Restrict `allow publish` to specific IPs
   - Use authentication for RTMP publishing
   - Enable SSL/TLS

2. **Secure the web interface:**
   - Add authentication
   - Use HTTPS
   - Restrict access to trusted networks

3. **Environment variables:**
   - Use environment variables for sensitive data
   - Never commit stream keys to version control

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Check the troubleshooting section
- Review nginx and application logs
- Open an issue on GitHub

---

## Quick Commands

```bash
# Start with Docker
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Start development server
npm run dev

# Install dependencies
npm install
```
