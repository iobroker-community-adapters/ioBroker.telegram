// this file used only for simulation and not used in end build
import React from 'react';
import { ThemeProvider, StyledEngineProvider } from '@mui/material/styles';

import { Box, Theme } from '@mui/material';

import {
    GenericApp,
    GenericAppProps,
    GenericAppState,
    I18n,
    IobTheme,
    Loader,
} from '@iobroker/adapter-react-v5';

import TelegramComponent from './TelegramComponent';

const styles: Record<string, any> = {
    app: (theme: Theme) => ({
        backgroundColor: theme.palette.background.default,
        color: theme.palette.text.primary,
        height: '100%',
    }),
    item: {
        padding: 50,
        width: 400
    }
};

declare global {
    interface Navigator {
        userLanguage?: string;
    }
}

class App extends GenericApp<GenericAppProps, GenericAppState & { data: any, theme: IobTheme }> {
    constructor(props: GenericAppProps) {
        const extendedProps = { ...props };
        super(props, extendedProps);

        this.state = {
            ...this.state,
            data: { myCustomAttribute: 'red' },
            theme: this.createTheme(),
        };
        const translations = {
            en: require('./i18n/en'),
            de: require('./i18n/de'),
            ru: require('./i18n/ru'),
            pt: require('./i18n/pt'),
            nl: require('./i18n/nl'),
            fr: require('./i18n/fr'),
            it: require('./i18n/it'),
            es: require('./i18n/es'),
            pl: require('./i18n/pl'),
            uk: require('./i18n/uk'),
            'zh-cn': require('./i18n/zh-cn'),
        };

        I18n.setTranslations(translations);
        I18n.setLanguage(
            (navigator.language || navigator.userLanguage || 'en').substring(0, 2).toLowerCase() as ioBroker.Languages            
        );
    }

    render() {
        if (!this.state.loaded) {
            return <StyledEngineProvider injectFirst>
                <ThemeProvider theme={this.state.theme}>
                    <Loader theme={this.state.themeType} />
                </ThemeProvider>
            </StyledEngineProvider>;
        }

        return <StyledEngineProvider injectFirst>
            <ThemeProvider theme={this.state.theme}>
                <Box sx={styles.app}>
                    <div style={styles.item}>
                        <TelegramComponent
                            oContext={{
                                socket: this.socket,
                                themeType: this.state.themeType,
                            }}
                            themeName={this.state.themeName}
                            attr='myCustomAttribute'
                            data={this.state.data}
                            onError={() => {}}
                            // instance={0}
                            schema={{
                                name: 'ConfigCustomTelegramSet/Components/TelegramComponent',
                                type: 'custom',
                            }}
                            onChange={data => this.setState({ data })}
                            alive
                            changed={false}
                            common={{}}
                            originalData={{}}
                        />
                    </div>
                </Box>
            </ThemeProvider>
        </StyledEngineProvider>;
    }
}

export default App;
