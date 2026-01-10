import { defineConfig } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import fs from 'fs'
import path from 'path'

// 检查是否存在自签名证书（用于局域网 HTTPS 访问）
const certPath = path.resolve(__dirname, 'cert')
const hasCert = fs.existsSync(path.join(certPath, 'key.pem')) && fs.existsSync(path.join(certPath, 'cert.pem'))

export default defineConfig({
  plugins: [uni()],
  server: {
    host: '0.0.0.0',  // 允许局域网访问
    port: 8080,
    // 如果有证书则启用 HTTPS（WebRTC 需要安全上下文）
    https: hasCert ? {
      key: fs.readFileSync(path.join(certPath, 'key.pem')),
      cert: fs.readFileSync(path.join(certPath, 'cert.pem')),
    } : undefined,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      '/socket.io': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        ws: true,
        secure: false
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
