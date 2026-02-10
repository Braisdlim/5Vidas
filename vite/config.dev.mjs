import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    base: './',
    plugins: [
        react(),
    ],
    resolve: {
        alias: {
            '@engine': path.resolve(__dirname, '../src/engine'),
            '@game': path.resolve(__dirname, '../src/game'),
            '@components': path.resolve(__dirname, '../src/components'),
        }
    },
    server: {
        port: 8080
    }
})
