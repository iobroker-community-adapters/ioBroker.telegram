// Proxy support for the connection to the telegram servers.
//
// node-telegram-bot-api v2 talks to telegram through `fetch`; a proxy is plugged in by handing the bot a fetch
// implementation that is bound to an undici dispatcher (HTTP(S) CONNECT proxy or SOCKS5). The same fetch is used
// for media downloads, so every telegram request goes through the proxy.

import { ProxyAgent, Socks5ProxyAgent, fetch as undiciFetch, type Dispatcher } from 'undici';

/** The proxy related part of the adapter configuration */
export interface ProxySettings {
    proxy?: boolean;
    /** `http` (default, also used for `https://` proxy URLs) or `socks5` */
    proxyType?: string;
    /** host name or IP; may carry a scheme (`https://proxy.local`) */
    proxyHost?: string;
    proxyPort?: number | string;
    proxyLogin?: string;
    proxyPassword?: string;
}

/** A ready-to-use proxy dispatcher plus a log-friendly description (never contains the password) */
export interface ProxyDispatcher {
    dispatcher: Dispatcher;
    description: string;
}

/**
 * Build the undici dispatcher for the configured proxy.
 *
 * @param settings the adapter configuration
 * @returns the dispatcher, or `undefined` when no proxy is enabled
 * @throws {Error} when the proxy is enabled but host or port are missing/invalid
 */
export function createProxyDispatcher(settings: ProxySettings): ProxyDispatcher | undefined {
    if (!settings.proxy) {
        return undefined;
    }

    const host = (settings.proxyHost || '').trim();
    const port = parseInt(String(settings.proxyPort), 10);
    if (!host) {
        throw new Error('proxy host is not configured');
    }
    if (!port || port < 1 || port > 65535) {
        throw new Error(`invalid proxy port "${settings.proxyPort}"`);
    }

    const username = (settings.proxyLogin || '').trim();
    const password = settings.proxyPassword || '';
    const type = settings.proxyType === 'socks5' ? 'socks5' : 'http';

    let url: URL;
    try {
        url = new URL(host.includes('://') ? host : `${type}://${host}`);
    } catch {
        throw new Error(`invalid proxy host "${host}"`);
    }
    url.port = String(port);
    const auth = username ? ` (user ${username})` : '';

    if (type === 'socks5') {
        return {
            dispatcher: new Socks5ProxyAgent(url.href, username ? { username, password } : undefined),
            description: `SOCKS5 proxy ${url.host}${auth}`,
        };
    }

    return {
        dispatcher: new ProxyAgent({
            uri: url.href,
            token: username ? `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` : undefined,
        }),
        description: `${url.protocol.replace(':', '').toUpperCase()} proxy ${url.host}${auth}`,
    };
}

/**
 * A `fetch` implementation that sends every request through the given dispatcher.
 *
 * @param dispatcher the proxy dispatcher
 * @returns a drop-in replacement for the global `fetch`
 */
export function createProxiedFetch(dispatcher: Dispatcher): typeof fetch {
    // undici ships its own (structurally compatible) Request/Response typings, hence the cast
    return ((input: Parameters<typeof undiciFetch>[0], init?: Parameters<typeof undiciFetch>[1]) =>
        undiciFetch(input, { ...init, dispatcher })) as unknown as typeof fetch;
}
