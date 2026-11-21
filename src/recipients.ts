// The recipients of the shared catalog of message commands (message.getRecipients, and `recipient` of send, edit
// and delete): what the bot already knows from communicate.users and communicate.chats. Nothing is sent to find them.

import type { Chats, Users } from './types';

/** One entry of the answer of `getRecipients` */
export interface Recipient {
    /** The user or chat id, usable as `recipient`, `user` or `chatId` */
    id: string;
    /** The first name of a user (else its username), the title of a group or channel */
    name: string;
    kind: 'user' | 'group' | 'chat';
    /** `send` without a recipient goes to every stored user */
    default?: true;
    /** The telegram username of a user, if it has one */
    userName?: string;
}

/**
 * The users who authenticated with the bot and the groups and channels it has seen. Private chats are the users
 * themselves and are not listed again.
 *
 * @param users the stored users (communicate.users)
 * @param chats the stored chats (communicate.chats)
 * @returns the recipients, users first
 */
export function listRecipients(users: Users, chats: Chats): Recipient[] {
    const list: Recipient[] = [];
    for (const [id, user] of Object.entries(users)) {
        const entry: Recipient = { id, name: user?.firstName || user?.userName || id, kind: 'user', default: true };
        if (user?.userName) {
            entry.userName = user.userName;
        }
        list.push(entry);
    }
    for (const [id, chat] of Object.entries(chats)) {
        if (chat?.type !== 'private' && !users[id]) {
            list.push({ id, name: chat?.title || id, kind: chat?.type === 'channel' ? 'chat' : 'group' });
        }
    }
    return list;
}

/**
 * The chat id of a recipient: an id of `getRecipients`, or the first name or username (with or without "@") of a
 * user, or the title of a group or channel, compared without case.
 *
 * @param recipient the id or name
 * @param users the stored users (communicate.users)
 * @param chats the stored chats (communicate.chats)
 * @returns the chat id, or undefined if nothing fits
 */
export function findRecipient(
    recipient: string | number | null | undefined,
    users: Users,
    chats: Chats,
): string | undefined {
    const text = recipient === undefined || recipient === null ? '' : String(recipient).trim();
    if (!text) {
        return undefined;
    }
    if (users[text] || chats[text]) {
        return text;
    }
    const name = text.replace(/^@/, '').toLowerCase();
    const same = (value?: string): boolean => !!value && value.replace(/^@/, '').toLowerCase() === name;
    return (
        Object.keys(users).find(id => same(users[id]?.firstName) || same(users[id]?.userName)) ??
        Object.keys(chats).find(id => chats[id]?.type !== 'private' && same(chats[id]?.title))
    );
}
