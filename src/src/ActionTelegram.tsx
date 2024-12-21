import WidgetGenericBlock from './GenericBlock';
import { I18n } from '@iobroker/adapter-react-v5';

import React from 'react';
import { IGenericBlock } from './IGenericBlock';
import { RuleBlockDescription, RuleContext, RuleTagCardTitle } from './types';
console.log((React as any).something);

declare global {
    interface Window {
        GenericBlock: typeof IGenericBlock;
    }
}

const GenericBlock = window.GenericBlock || WidgetGenericBlock;

class ActionTelegram extends GenericBlock {
    cachePromises: any;
    
    constructor(props: any) {
        super(props, ActionTelegram.getStaticData());
        this.cachePromises = {};
    }

    static compile(config: any, context: RuleContext) {
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

    renderDebug(debugMessage: any) {
        return `${I18n.t('Sent:')} ${debugMessage.data.text}`;
    }

    onValueChanged(value: any, attr: string) {
        if (attr === 'instance') {
            this._setUsers(value);
        }
    }

    _setUsers(instance?: any) {
        instance = instance || (this.state.settings as any).instance || 'telegram.0';
        this.cachePromises[instance] = this.cachePromises[instance] || this.props.socket.getState(`${instance}.communicate.users`);
        if (!this.state.settings._id) {
            return this.setState({
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
                    }
                ]
            }, () => super.onTagChange());
        }

        this.cachePromises[instance]
            .then((users: any) => {
                try {
                    users = users?.val ? JSON.parse(users.val) : null;
                    users = users && Object.keys(users).map(user => ({title: users[user].userName || users[user].firstName, value: user}));
                    users = users || [];
                    users.unshift({title: 'all', value: ''});
                } catch (e) {
                    users = [{title: 'all', value: ''}];
                }

                this.setState({
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
                            options: users,
                            defaultValue: '_',
                            frontText: 'User:',
                        },
                        {
                            nameRender: 'renderModalInput',
                            attr: 'text',
                            defaultValue: 'Hallo',
                            nameBlock: '',
                            frontText: 'Text:',
                        }
                    ]
                }, () => super.onTagChange());
            });
    }

    onTagChange(tagCard: RuleTagCardTitle) {
        this._setUsers();
    }

    static getStaticData(): RuleBlockDescription {
        return {
            acceptedBy: 'actions',
            name: 'Telegram',
            id: 'ActionTelegram',
            adapter: 'telegram',
            title: 'Sends message via telegram',
            helpDialog: 'You can use %s in the text to display current trigger value or %id to display the triggered object ID'
        }
    }

    getData() {
        return ActionTelegram.getStaticData();
    }
}

export default ActionTelegram;
