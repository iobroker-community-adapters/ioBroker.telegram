const { shared } = require('@iobroker/adapter-react-v5/modulefederation.admin.config');

module.exports = {
    name: 'ConfigCustomTelegramSet',
    filename: 'customComponents.js',
    exposes: {
        './Components': './src/Components.jsx',
    },
    shared,
};
