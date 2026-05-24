const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

const app = express();

// Proxy API requests to the C++ backend
app.use('/api', createProxyMiddleware({ 
    target: 'http://localhost:8080', 
    changeOrigin: true 
}));

// Serve frontend SPA
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(3000, '0.0.0.0', () => {
  console.log('Frontend server running on http://localhost:3000');
});
