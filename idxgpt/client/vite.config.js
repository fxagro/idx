import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,          // biar bisa diakses dari IP publik / tunnel
    port: 5173,
    allowedHosts: [
      '.ngrok-free.app', // semua subdomain ngrok
      '.loca.lt',        // localtunnel
      '.trycloudflare.com', // kalau pakai cloudflare tunnel
      'localhost',       // tetap izinkan localhost
    ],
    proxy: {
       '/api': {
         target: process.env.VITE_API_URL || 'http://localhost:3001',
         changeOrigin: true,
         secure: false,
         ws: true,
         configure: (proxy, options) => {
           proxy.on('error', (err, req, res) => {
             console.log('proxy error', err);
           });
           proxy.on('proxyReq', (proxyReq, req, res) => {
             console.log('Sending Request to the Target:', req.method, req.url);
           });
           proxy.on('proxyRes', (proxyRes, req, res) => {
             console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
           });
         },
       }
     }
  }
})
