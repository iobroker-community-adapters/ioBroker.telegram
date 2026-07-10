// Helpers to parse/serialize ioBroker URIs and to derive the telegram media type from a file name.
// See issue #907: allow sending files that live in the ioBroker file storage (e.g. behind Redis/jsonl)
// where the file is not accessible through the local filesystem.

import type { IobUri, IobUriParsed } from './types';

/**
 * Serialize a parsed ioBroker URI back to its string form.
 *
 * @param uri the parsed URI
 * @returns the URI in string form
 */
export function iobUriToString(uri: IobUriParsed): IobUri {
    if (uri.type === 'object') {
        return `iobobject://${uri.address}/${uri.path || ''}`;
    }
    if (uri.type === 'state') {
        return `iobstate://${uri.address}`;
    }
    if (uri.type === 'file') {
        return `iobfile://${uri.address}/${uri.path || ''}`;
    }
    if (uri.type === 'http') {
        return uri.address;
    }
    if (uri.path?.includes('/')) {
        return `iobfile://${uri.address}/${uri.path}`;
    }
    if (uri.path) {
        return `iobobject://${uri.address}/${uri.path}`;
    }
    return `iobstate://${uri.address}`;
}

/** The ioBroker URI schemes that this adapter resolves internally (http is handled by telegram itself). */
const IOB_SCHEME_REGEX = /^(iobfile|iobobject|iobstate):\/\//i;

/**
 * Whether the given string is an ioBroker URI that this adapter has to resolve before sending.
 *
 * @param text the candidate string
 * @returns true if the string uses one of the `iob*://` schemes
 */
export function isIobUri(text: string): boolean {
    return IOB_SCHEME_REGEX.test(text);
}

/**
 * Split the part after `scheme://` into an address and an optional path at the first slash.
 *
 * @param rest the string after the `scheme://` prefix
 * @returns the address and the (optional) path
 */
function splitAddressAndPath(rest: string): { address: string; path?: string } {
    const slash = rest.indexOf('/');
    if (slash === -1) {
        return { address: rest };
    }
    const path = rest.substring(slash + 1);
    return { address: rest.substring(0, slash), path: path || undefined };
}

/**
 * Parse an ioBroker URI string into its structured form. A string without a known scheme is treated
 * as a plain web URL (if it looks like one) or as a state id otherwise.
 *
 * @param uri the URI string
 * @returns the parsed URI
 */
export function iobUriFromString(uri: IobUri): IobUriParsed {
    if (/^iobobject:\/\//i.test(uri)) {
        return { type: 'object', ...splitAddressAndPath(uri.substring('iobobject://'.length)) };
    }
    if (/^iobstate:\/\//i.test(uri)) {
        return { type: 'state', address: uri.substring('iobstate://'.length) };
    }
    if (/^iobfile:\/\//i.test(uri)) {
        return { type: 'file', ...splitAddressAndPath(uri.substring('iobfile://'.length)) };
    }
    if (/^https?:\/\//i.test(uri)) {
        return { type: 'http', address: uri };
    }
    return { type: 'state', address: uri };
}

/**
 * Derive the telegram media type (as used by the internal send dispatcher) from a file name or URL.
 * The mapping mirrors the extension checks used for filesystem paths in `sendMessageHelper`.
 *
 * @param name the file name, path or URL (query string is ignored)
 * @returns the media type or undefined if the extension is unknown
 */
export function detectMediaTypeFromName(name: string): string | undefined {
    if (/\.webp(\?|$)/i.test(name)) {
        return 'sticker';
    }
    if (/\.gif(\?|$)/i.test(name)) {
        return 'animation';
    }
    if (/\.mp4(\?|$)/i.test(name)) {
        return 'video';
    }
    if (/\.(wav|mp3|ogg)(\?|$)/i.test(name)) {
        return 'audio';
    }
    if (/\.(jpg|jpeg|png|bmp)(\?|$)/i.test(name)) {
        return 'photo';
    }
    if (/\.(txt|doc|docx|csv|pdf|xls|xlsx)(\?|$)/i.test(name)) {
        return 'document';
    }
    return undefined;
}

/**
 * Map a MIME type to the internal telegram media type.
 *
 * @param mime the MIME type (e.g. `image/png`)
 * @returns the media type
 */
export function mimeToMediaType(mime: string): string {
    if (mime.startsWith('image/')) {
        return mime === 'image/gif' ? 'animation' : 'photo';
    }
    if (mime.startsWith('video/')) {
        return 'video';
    }
    if (mime.startsWith('audio/')) {
        return 'audio';
    }
    return 'document';
}
