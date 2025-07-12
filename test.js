#!/usr/bin/env node

// Simple test script to verify the system setup
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing RTMP YouTube Stream Controller Setup...');
console.log('==================================================');

// Check if all required files exist
const requiredFiles = [
    'server.js',
    'package.json',
    'nginx.conf',
    'docker-compose.yml',
    'public/index.html',
    'public/styles.css',
    'public/script.js',
    'README.md'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file} exists`);
    } else {
        console.log(`❌ ${file} missing`);
        allFilesExist = false;
    }
});

// Check package.json structure
try {
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    console.log('\n📦 Package.json Analysis:');
    console.log(`   Name: ${packageJson.name}`);
    console.log(`   Version: ${packageJson.version}`);
    console.log(`   Main: ${packageJson.main}`);
    console.log(`   Dependencies: ${Object.keys(packageJson.dependencies).length}`);
} catch (error) {
    console.log('❌ Error reading package.json:', error.message);
    allFilesExist = false;
}

// Check nginx configuration
try {
    const nginxConf = fs.readFileSync('nginx.conf', 'utf8');
    console.log('\n⚙️  Nginx Configuration:');
    console.log(`   Contains RTMP block: ${nginxConf.includes('rtmp {') ? '✅' : '❌'}`);
    console.log(`   Contains HTTP block: ${nginxConf.includes('http {') ? '✅' : '❌'}`);
    console.log(`   HLS configured: ${nginxConf.includes('hls on') ? '✅' : '❌'}`);
    console.log(`   Port 1935 configured: ${nginxConf.includes('1935') ? '✅' : '❌'}`);
    console.log(`   Port 8080 configured: ${nginxConf.includes('8080') ? '✅' : '❌'}`);
} catch (error) {
    console.log('❌ Error reading nginx.conf:', error.message);
    allFilesExist = false;
}

// Check HTML structure
try {
    const htmlContent = fs.readFileSync('public/index.html', 'utf8');
    console.log('\n🌐 HTML Interface:');
    console.log(`   Contains video element: ${htmlContent.includes('<video') ? '✅' : '❌'}`);
    console.log(`   Contains YouTube config form: ${htmlContent.includes('youtubeUrl') ? '✅' : '❌'}`);
    console.log(`   Contains start/stop buttons: ${htmlContent.includes('startBtn') ? '✅' : '❌'}`);
    console.log(`   Socket.io included: ${htmlContent.includes('socket.io') ? '✅' : '❌'}`);
    console.log(`   HLS.js included: ${htmlContent.includes('hls.js') ? '✅' : '❌'}`);
} catch (error) {
    console.log('❌ Error reading HTML file:', error.message);
    allFilesExist = false;
}

// Summary
console.log('\n📊 Summary:');
console.log('===========');
if (allFilesExist) {
    console.log('✅ All required files are present and properly configured!');
    console.log('\n🚀 Next Steps:');
    console.log('1. Run "npm install" to install dependencies');
    console.log('2. Use Docker: "docker-compose up -d"');
    console.log('3. Or manual setup: "chmod +x setup.sh && ./setup.sh"');
    console.log('4. Access the web interface at http://localhost:3000');
    console.log('5. Configure RTMP stream to rtmp://localhost:1935/live/stream');
} else {
    console.log('❌ Some files are missing or misconfigured.');
    console.log('   Please check the setup and try again.');
}

console.log('\n📋 System Architecture:');
console.log('┌─────────────────────────────────────────────────────────────┐');
console.log('│  [OBS/Encoder] → [nginx-rtmp] → [Preview (HLS)] → [Browser]   │');
console.log('│                      ↓                                       │');
console.log('│                 [ffmpeg] → [YouTube Live]                    │');
console.log('└─────────────────────────────────────────────────────────────┘');
console.log('');
console.log('Ports:');
console.log('• 1935: RTMP input from OBS');
console.log('• 8080: HLS preview stream');
console.log('• 3000: Web interface');
console.log('');
console.log('💡 For troubleshooting, check the README.md file.');