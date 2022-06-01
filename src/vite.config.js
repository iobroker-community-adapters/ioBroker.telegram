import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import federation from '@originjs/vite-plugin-federation';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        // react(),
        federation({
            filename: 'customComponents.js',
            exposes: {
                './ActionTelegram': './src/ActionTelegram.jsx',
            },
            shared: {'react': {}, 'react-dom': {}, 'prop-types': {}, './src/GenericBlock.jsx': {
                packageName: 'GenericBlock',
            }}
        })
    ],
    build: {
        target: 'esnext',
        minify: false,
        cssCodeSplit: true,
        // rollupOptions: {
        //   output: {
        //     // format: 'esm',
        //     dir: 'dist',
        //     minifyInternalExports: false
        //   }
        // },
        sourcemap: true // 'inline'
    }
})
