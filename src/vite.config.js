// import { defineConfig, transformWithEsbuild } from 'vite';
import react from '@vitejs/plugin-react';
import commonjs from 'vite-plugin-commonjs';
import svgr from 'vite-plugin-svgr';
// import vitetsConfigPaths from 'vite-tsconfig-paths';
import { federation } from '@module-federation/vite';

const makeShared = pkgs => {
    const result = {};
    pkgs.forEach(
        packageName => {
            result[packageName] = {
                requiredVersion: '*',
                singleton: true,
            };
        },
    );
    return result;
};

const config = ({
  plugins: [
    federation( {
      manifest: true,
      name: 'ActionTelegram',
    filename: 'customRuleBlocks.js',
    exposes: {
        './ActionTelegram': './src/ActionTelegram.jsx',
    },
    remotes: {},
    shared: makeShared([
        'react', '@iobroker/adapter-react-v5', 'react-dom', 'prop-types'
    ])
    }),
    react(),
    // vitetsConfigPaths(),
    commonjs(),
    svgr({
      include: [
        'src/**/*.svg',
      ],
    }),
  ],
  server: {
    port: 3000
  },
  build: {
    target: 'chrome89',
  },
});

module.exports = config;