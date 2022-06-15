const makeShared = pkgs => {
    const result = {};
    pkgs.forEach(
        packageName => {
            result[packageName] = {
                requiredVersion: '*',
            };
        },
    );
    return result;
};

module.exports = {
    name: 'ActionTelegram',
    filename: 'customRuleBlocks.js',
    exposes: {
        './ActionTelegram': './src/ActionTelegram.jsx',
    },
    shared: makeShared([
        'react', '@iobroker/adapter-react-v5', 'react-dom', 'prop-types'
    ])
};
