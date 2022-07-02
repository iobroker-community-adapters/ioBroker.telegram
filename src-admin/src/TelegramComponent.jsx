import React from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@mui/styles';

import { Button } from '@mui/material';

// important to make from package and not from some children.
// invalid
// import ConfigGeneric from '@iobroker/adapter-react-v5/ConfigGeneric';
// valid
import { ConfigGeneric, ColorPicker } from '@iobroker/adapter-react-v5';

const styles = () => ({
    table: {
        minWidth: 400
    },
    header: {
        fontSize: 16,
        fontWeight: 'bold'
    }
});

class TelegramComponent extends ConfigGeneric {
    componentDidMount() {
        super.componentDidMount();

        this.props.socket.getState('system.adapter.admin.0.alive')
            .then(result => console.log(result));
    }

    buttonHandler = () => {
        window.alert('button event');
    };

    renderItem(/*error, disabled, defaultValue*/) {
        const value = ConfigGeneric.getValue(this.props.data, this.props.attr);

        return <>
            <Button color="secondary" variant="contained" onClick={this.buttonHandler}>Example Button</Button>
            <ColorPicker value={value} onChange={color => {
                this.onChange(this.props.attr, color);
            }}/>
        </>;
    }
}

TelegramComponent.propTypes = {
    socket: PropTypes.object.isRequired,
    themeType: PropTypes.string,
    themeName: PropTypes.string,
    style: PropTypes.object,
    className: PropTypes.string,
    data: PropTypes.object.isRequired,
    attr: PropTypes.string,
    schema: PropTypes.object,
    onError: PropTypes.func,
    onChange: PropTypes.func,
};

export default withStyles(styles)(TelegramComponent);