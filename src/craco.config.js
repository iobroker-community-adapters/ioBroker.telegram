const CracoEsbuildPlugin = require('craco-esbuild');
const { ProvidePlugin, IgnorePlugin } = require('webpack');
const { ModuleFederationPlugin } = require('webpack').container;
const deps = require('./package.json').dependencies;
const cracoModuleFederation = require('craco-module-federation');

console.log('craco');

module.exports = {
    plugins: [{ plugin: CracoEsbuildPlugin }, { plugin: cracoModuleFederation }],
    webpack: {
        output: {
            publicPath: 'auto',
        },
        plugins: [
            // new HtmlWebpackPlugin(),
            new ProvidePlugin({
                React: 'react',
            }),
            // new ModuleFederationPlugin({
            //     name: 'Thermostat',
            //     // library: { type: 'module' },
            //     // library: { type: 'var', name: 'MaterialDemo' },
            //     filename: 'customWidgets.js',
            //     exposes: {
            //         './Thermostat': './src/Thermostat',
            //     },
            //     shared:
            //         [
            //             'react', 'react-dom', '@mui/material', '@mui/styles', '@mui/icons-material', 'prop-types', '@iobroker/adapter-react-v5', 'react-ace',
            //         ],
            //     // shared: {
            //     // react: {singleton: true,
            //     //     eager: true,
            //     //     requiredVersion: deps.react},
            //     // 'react-dom': {singleton: true,
            //     //     requiredVersion: deps.react['react-dom']},
            //     // '@mui/material': {singleton: true},
            //     // '@mui/icons-material': {singleton: true},
            //     // 'prop-types': {singleton: true},
            //     // '@iobroker/adapter-react-v5': {singleton: true},
            //     // '@mui/styles': {singleton: true},
            //     // 'react-ace': {singleton: true},
            //     // }
            //     // './src/visRxWidget.jsx': {
            //     //     packageName: 'visRxWidget',
            //     // },

            // }),
            // new IgnorePlugin({
            //     resourceRegExp: /myvisRxWidget/,
            // }),
        ],
        configure: webpackConfig => {
        //   console.log(webpackConfig);
        //   process.exit();
            webpackConfig.output.publicPath = 'auto';
            return webpackConfig;
        },
    },
};
