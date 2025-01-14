import React from 'react';
import WidgetGenericBlock from './GenericBlock';
import { I18n } from '@iobroker/adapter-react-v5';

import { GenericBlockProps, IGenericBlock } from './IGenericBlock';
import { RuleBlockConfig, RuleBlockDescription, RuleContext, RuleTagCardTitle } from './types';

declare global {
    interface Window {
        GenericBlock: typeof IGenericBlock;
    }
}

const GenericBlock = window.GenericBlock || WidgetGenericBlock;

export interface TelegramRuleBlockConfig extends RuleBlockConfig {
    text: string;
    instance: string;
    user: string;
    tagCard?: RuleTagCardTitle;
}

class ActionTelegram extends GenericBlock<TelegramRuleBlockConfig> {
    cachePromises: Record<string, Promise<ioBroker.State>>;

    constructor(props: GenericBlockProps<TelegramRuleBlockConfig>) {
        super(props, ActionTelegram.getStaticData());
        this.cachePromises = {};
    }

    static compile(config: TelegramRuleBlockConfig, context: RuleContext): string {
        let text = (config.text || '').replace(/"/g, '\\"');
        if (!text) {
            return `// no text defined
_sendToFrontEnd(${config._id}, {text: 'No text defined'});`;
        } else {
            return `// Telegram ${text || ''}
\t\tconst subActionVar${config._id} = "${(text || '').replace(/"/g, '\\"')}"${GenericBlock.getReplacesInText(context)};
\t\t_sendToFrontEnd(${config._id}, {text: subActionVar${config._id}});
\t\tsendTo("${config.instance}", "send", ${config.user && config.user !== '_' ? `{user: "${(config.user || '').replace(/"/g, '\\"')}", text: subActionVar${config._id}}` : `subActionVar${config._id}`});`;
        }
    }

    renderDebug(debugMessage: { data: { text: string } }): React.JSX.Element | string {
        return `${I18n.t('Sent:')} ${debugMessage.data.text}`;
    }

    onValueChanged(value: any, attr: string): void {
        if (attr === 'instance') {
            this._setUsers(value);
        }
    }

    _setUsers(instance?: string): void {
        instance = instance || this.state.settings.instance || 'telegram.0';
        this.cachePromises[instance!] =
            this.cachePromises[instance!] || this.props.socket.getState(`${instance}.communicate.users`);

        if (!this.state.settings._id) {
            return this.setState(
                {
                    inputs: [
                        {
                            nameRender: 'renderSelect',
                            adapter: 'telegram',
                            frontText: 'Instance:',
                            defaultValue: 'telegram.0',
                            attr: 'instance',
                        },
                        {
                            nameRender: 'renderSelect',
                            attr: 'user',
                            options: [{ title: 'telegram.0', value: 'telegram.0' }],
                            defaultValue: '',
                            frontText: 'User:',
                        },
                        {
                            nameRender: 'renderModalInput',
                            attr: 'text',
                            defaultValue: 'Hallo',
                            nameBlock: '',
                            frontText: 'Text:',
                        },
                    ],
                },
                () => super.onTagChange(),
            );
        }

        this.cachePromises[instance].then((users: ioBroker.State): void => {
            let options: { title: string; value: string }[];
            try {
                const usersStruct: Record<string, { userName: string; firstName: string }> | null = users?.val
                    ? JSON.parse(users.val as string)
                    : null;
                options =
                    usersStruct ?
                    Object.keys(usersStruct).map(user => ({
                        title: usersStruct[user].userName || usersStruct[user].firstName,
                        value: user,
                    })) : [];
                options.unshift({ title: 'all1', value: '' });
            } catch (e) {
                options = [{ title: 'all1', value: '' }];
            }

            this.setState(
                {
                    inputs: [
                        {
                            nameRender: 'renderInstance',
                            adapter: 'telegram',
                            frontText: 'Instance:',
                            defaultValue: 'telegram.0',
                            attr: 'instance',
                        },
                        {
                            nameRender: 'renderSelect',
                            attr: 'user',
                            options,
                            defaultValue: '_',
                            frontText: 'User:',
                        },
                        {
                            nameRender: 'renderModalInput',
                            attr: 'text',
                            defaultValue: 'Hallo',
                            nameBlock: '',
                            frontText: 'Text:',
                        },
                    ],
                },
                () => super.onTagChange(),
            );
        });
    }

    onTagChange(tagCard: RuleTagCardTitle): void {
        this._setUsers();
    }

    static getStaticData(): RuleBlockDescription {
        return {
            acceptedBy: 'actions',
            name: 'Telegram',
            id: 'ActionTelegram',
            adapter: 'telegram',
            title: 'Sends message via telegram',
            helpDialog:
                'You can use %s in the text to display current trigger value or %id to display the triggered object ID',
        };
    }

    getData(): RuleBlockDescription {
        return ActionTelegram.getStaticData();
    }
}

export default ActionTelegram;
