import React from 'react';

import {
    Checkbox,
    IconButton,
    LinearProgress,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
} from '@mui/material';
import { Delete as IconDelete } from '@mui/icons-material';
// important to make from package and not from some children.
// invalid
// import ConfigGeneric from '@iobroker/adapter-react-v5/ConfigGeneric';
// valid
import { Confirm, I18n } from '@iobroker/adapter-react-v5';
import { ConfigGeneric, type ConfigGenericProps, type ConfigGenericState } from '@iobroker/json-config';

interface TelegramUser {
    id: string;
    firstName: string;
    lastName: string;
    userName: string;
    sysMessages: boolean;
}

interface TelegramComponentState extends ConfigGenericState {
    alive: boolean;
    initialized: boolean;
    users: { id: string; names: string; sysMessages: boolean }[];
    confirm: string | null;
}

class TelegramComponent extends ConfigGeneric<ConfigGenericProps, TelegramComponentState> {
    constructor(props: ConfigGenericProps) {
        super(props);
        this.state = {
            ...this.state,
            alive: false,
            initialized: false,
            users: [],
            confirm: null,
        };
    }

    componentDidMount(): void {
        super.componentDidMount();

        this.props.oContext.socket
            .getState(`system.adapter.telegram.${this.props.oContext.instance}.alive`)
            .then(async (state: ioBroker.State) => {
                if (state && state.val) {
                    this.setState({ alive: true }, () => this.readData());
                } else {
                    this.setState({ alive: false });
                }

                await this.props.oContext.socket.subscribeState(
                    `system.adapter.telegram.${this.props.oContext.instance}.alive`,
                    this.onAliveChanged,
                );
            });
    }

    readData(): void {
        this.props.oContext.socket
            .sendTo(`telegram.${this.props.oContext.instance}`, 'adminuser', null)
            .then((obj: Record<string, TelegramUser>) => {
                // get admin user
                const users = [];
                for (const id in obj) {
                    const names: string[] = [];
                    obj[id].userName && names.push(obj[id].userName);
                    obj[id].firstName && names.push(obj[id].firstName);
                    users.push({
                        id,
                        names: names.join(' / '),
                        sysMessages: obj[id].sysMessages,
                    });
                }
                this.setState({ users, initialized: true });
            });
    }

    async componentWillUnmount(): Promise<void> {
        await this.props.oContext.socket.unsubscribeState(
            `system.adapter.telegram.${this.props.oContext.instance}.alive`,
            this.onAliveChanged,
        );
    }

    onAliveChanged = (_id: string, state: ioBroker.State): void => {
        const alive: boolean = state ? (state.val as boolean) : false;
        if (alive !== this.state.alive) {
            this.setState({ alive }, () => {
                if (alive && !this.state.initialized) {
                    this.readData();
                }
            });
        }
    };

    onSysMessageChange(id: string): void {
        const pos = this.state.users.findIndex(item => item.id === id);
        if (pos !== -1) {
            const checked = !this.state.users[pos].sysMessages;

            this.props.oContext.socket
                .sendTo(`telegram.${this.props.oContext.instance}`, 'systemMessages', { itemId: id, checked })
                .then((obj: string) => {
                    if (obj === id) {
                        const users: TelegramComponent['state']['users'] = JSON.parse(JSON.stringify(this.state.users));
                        const pos = users.findIndex(item => item.id === id);
                        if (pos !== -1) {
                            users[pos].sysMessages = checked;
                            this.setState({ users });
                        }
                    }
                });
        }
    }

    onDelete(id: string): void {
        this.props.oContext.socket
            .sendTo(`telegram.${this.props.oContext.instance}`, 'delUser', id)
            .then((obj: string) => {
                if (obj === id) {
                    const users: TelegramComponent['state']['users'] = JSON.parse(JSON.stringify(this.state.users));
                    const pos = users.findIndex(item => item.id === id);
                    if (pos !== -1) {
                        users.splice(pos, 1);
                        this.setState({ users });
                    }
                }
            });
    }

    renderConfirmDialog(): React.JSX.Element | null {
        if (this.state.confirm) {
            return (
                <Confirm
                    onClose={result => {
                        const id = this.state.confirm;
                        this.setState({ confirm: null }, () => result && this.onDelete(id!));
                    }}
                />
            );
        }

        return null;
    }

    renderItem(): React.JSX.Element {
        if (!this.state.alive && !this.state.initialized) {
            return <div>{I18n.t('custom_telegram_not_alive')}</div>;
        }
        if (!this.state.initialized) {
            return <LinearProgress />;
        }
        return (
            <div style={{ width: '100%' }}>
                <h4>{I18n.t('custom_telegram_title')}</h4>
                <TableContainer
                    component={Paper}
                    style={{ width: '100%' }}
                >
                    <Table
                        style={{ width: '100%' }}
                        size="small"
                    >
                        <TableHead>
                            <TableRow>
                                <TableCell>{I18n.t('custom_telegram_id')}</TableCell>
                                <TableCell>{I18n.t('custom_telegram_name')}</TableCell>
                                <TableCell>{I18n.t('custom_telegram_sys_messages')}</TableCell>
                                <TableCell></TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {this.state.users.map(user => (
                                <TableRow
                                    key={user.id}
                                    sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                                >
                                    <TableCell
                                        component="th"
                                        scope="row"
                                    >
                                        {user.id}
                                    </TableCell>
                                    <TableCell>{user.names}</TableCell>
                                    <TableCell>
                                        <Checkbox
                                            disabled={!this.state.alive}
                                            checked={!!user.sysMessages}
                                            onClick={() => this.onSysMessageChange(user.id)}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <IconButton
                                            disabled={!this.state.alive}
                                            onClick={() => this.setState({ confirm: user.id })}
                                        >
                                            <IconDelete />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                {this.renderConfirmDialog()}
            </div>
        );
    }
}

export default TelegramComponent;
