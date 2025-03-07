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
            shared: makeShared([
                '@emotion/react',
                '@emotion/styled',
                '@iobroker/adapter-react-v5',
                '@iobroker/json-config',
                '@iobroker/dm-gui-components',
                '@mui/icons-material',
                '@mui/material',
                '@mui/x-date-pickers',
                'date-fns',
                'leaflet',
                'leaflet-geosearch',
                'react',
                'react-ace',
                'react-dom',
                'react-dropzone',
                'semver',
            ]),
        }),
        react(),
        vitetsConfigPaths(),
        commonjs(),
    ],
    server: {
        port: 3000,
        proxy: {
            '/files': 'http://localhost:8081',
            '/adapter': 'http://localhost:8081',
            '/session': 'http://localhost:8081',
            '/log': 'http://localhost:8081',
            '/lib': 'http://localhost:8081',        },
    },
    base: './',
    build: {
        target: 'chrome89',
        outDir: './build',
    },
};

export default config;
