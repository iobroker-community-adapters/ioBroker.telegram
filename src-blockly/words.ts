/**
 * The words of all telegram blocks.
 *
 * They are bundled into `admin/blockly.js` at build time, because the editor loads that file as a
 * classic script and `Blockly.Words` must be filled before the blocks are registered - there is no
 * moment at which the files could be fetched. `npm run translate` keeps `i18n/` up to date.
 */
import de from './i18n/de.json';
import en from './i18n/en.json';
import es from './i18n/es.json';
import fr from './i18n/fr.json';
import it from './i18n/it.json';
import nl from './i18n/nl.json';
import pl from './i18n/pl.json';
import pt from './i18n/pt.json';
import ru from './i18n/ru.json';
import uk from './i18n/uk.json';
import zhCn from './i18n/zh-cn.json';

const Blockly = window.Blockly;

const LANGUAGES: Record<string, Record<string, string>> = {
    de,
    en,
    es,
    fr,
    it,
    nl,
    pl,
    pt,
    ru,
    uk,
    'zh-cn': zhCn,
};

const README = 'https://github.com/ioBroker/ioBroker.telegram/blob/master/README.md';

/** Fills `Blockly.Words` with everything the telegram blocks need */
export function installWords(): void {
    // Older editors do not ship a translator yet
    Blockly.Translate ||= function (word: string, lang?: string): string {
        lang ||= window.systemLang;
        const entry = Blockly.Words?.[word];
        return entry ? entry[lang || 'en'] || entry.en : word;
    };

    // `Blockly.Words` is keyed by word and not by language, so the files must be turned inside out.
    // A language that does not have a word simply falls back to English, which is why the files are
    // allowed to be incomplete.
    const words: Record<string, Record<string, string>> = {};
    for (const [lang, texts] of Object.entries(LANGUAGES)) {
        for (const [word, text] of Object.entries(texts)) {
            if (text) {
                (words[word] ||= {})[lang] = text;
            }
        }
    }
    Object.assign(Blockly.Words, words);

    // Links, not words - they must not be handed to the translator. The same URL in every language,
    // which is what the hand-written table used to spell out once per language.
    Blockly.Words.telegram_help = { en: README };
    Blockly.Words.telegram_call_help = { en: `${README}#calls-via-telegram` };
}
