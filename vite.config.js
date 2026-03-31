import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: false,
    hmr: {
      overlay: true
    },
    // 禁用 HTTP 缓存
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        // 在文件名中添加哈希值，避免缓存问题
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  // 开发模式下禁用依赖预编译缓存
  optimizeDeps: {
    force: true
  }
})
