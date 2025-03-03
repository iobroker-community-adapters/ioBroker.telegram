import react from '@vitejs/plugin-react';
import commonjs from 'vite-plugin-commonjs';
import vitetsConfigPaths from 'vite-tsconfig-paths';
import { federation } from '@module-federation/vite';

const makeShared = pkgs => {
    const result = {};
    pkgs.forEach(packageName => {
        result[packageName] = {
            requiredVersion: '*',
            singleton: true,
        };
    });
    return result;
};

const config = {
    plugins: [
        federation({
            manifest: true,
            name: 'ConfigCustomTelegramSet',
            filename: 'customComponents.js',
            exposes: {
                './Components': './src/Components.tsx',
            },
            remotes: {},
            shared: makeShared(['react', '@iobroker/json-config', '@iobroker/adapter-react-v5', 'react-dom', 'prop-types']),
        }),
        react(),
        vitetsConfigPaths(),
        commonjs(),
    ],
    server: {
        port: 3000,
        proxy: {
            '/lib/js/socket.io.js': 'http://127.0.0.1:8081',
        },
    },
    base: './',
    build: {
        target: 'chrome89',
        outDir: './build',
    },
};

export default config;
