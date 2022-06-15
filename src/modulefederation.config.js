module.exports = {
    name: 'ActionTelegram',
    filename: 'customRuleBlocks.js',
    exposes: {
        './ActionTelegram': './src/ActionTelegram.jsx',
    },
    shared: {
        'react': {},
        '@iobroker/adapter-react-v5': {},
        'react-dom': {},
        'prop-types': {},
    }
};
