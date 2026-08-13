# Blockly blocks

Source of `admin/blockly.js`, the three blocks ioBroker.javascript's Blockly editor shows in its
`sendTo` category - `telegram` (send), `telegram_call` (call) and `telegram_ask` (question with
answer buttons). **`admin/blockly.js` is generated - never edit it directly.**

```bash
npm run build:blockly   # type check + bundle into admin/blockly.js
```

`npm run build` runs it too, so a release always ships a bundle that matches this source.

The bundle stays committed: installations from GitHub do not run `prepublishOnly`, so the built file
has to be in the repository.

| file | |
|---|---|
| `blockly.ts` | entry point, installs the words and the three blocks |
| `blocks/telegram.ts`, `blocks/telegramCall.ts`, `blocks/telegramAsk.ts` | one block each |
| `helpers.ts` | the dropdowns, the log line and the generator registration they share |
| `voices.ts` | the 92 voices of the call block |
| `words.ts`, `i18n/*.json` | the words |

## Take the types from `blockly`, the runtime from `window`

`blockly` is a **dev** dependency - it contributes types and nothing else:

```ts
import type { Block } from 'blockly/core';

const Blockly = window.Blockly;
```

Never `import * as Blockly from 'blockly/core'` here. The editor loads this file long after it has
created its own Blockly instance, and an import would bundle a *second*, private one. The blocks
would register themselves on that private instance and stay invisible to the editor - with no error
anywhere.

The globals the editor provides (`window.Blockly` including its ioBroker extras `Words`, `Translate`,
`Sendto` and `Object`, plus `window.main` and `window.systemLang`) are declared in
`iobroker-blockly.d.ts`.

## Words

`i18n/*.json` holds one file per language, keyed by word - the layout `translate-adapter` expects,
which is why `npm run translate` passes `-b src-blockly/i18n/en.json`. `words.ts` imports them and
turns them inside out into `Blockly.Words` (keyed by word, then language).

A language file is allowed to be incomplete: `Blockly.Translate` falls back to English for a word it
does not find, which is what the hand-written table relied on - `uk` and `zh-cn` only ever had a few
of the words. Run `npm run translate` to fill the gaps.

The two help URLs are not in there. They are links, not words, so `words.ts` sets them directly.

They are bundled rather than fetched: the editor loads `admin/blockly.js` as a classic script and
`Blockly.Words` has to be filled before the blocks register themselves, so there is no point at which
the files could be loaded over the network.

## What Blockly 13 removed, and where it is handled

| removed | replacement |
|---|---|
| `Blockly.ALIGN_RIGHT` | `Blockly.inputs.Align.RIGHT` - same value, see `ALIGN_RIGHT` in `blocks/telegramAsk.ts` |
| `Blockly.icons.MutatorIcon.reconnect(…)` | gone without replacement, carried as `reconnectChild()` in `helpers.ts` |
| the generator fallback `Blockly.JavaScript.<type>` | `Blockly.JavaScript.forBlock.<type>`, see `registerGenerator()` |

Until this was fixed, `setAlign(undefined)` silently lost the alignment of the answer inputs and
`compose()` threw as soon as the mutator dialog was closed - so answers could not be added or removed
at all.

## Empty inputs

`valueToCode` returns an empty string for an unconnected input. Anything built by string
concatenation has to leave that part out instead of emitting `text: ,` or `'…' + )`, both of which
are syntax errors that take the user's entire script down. `logLine()` in `helpers.ts` does this for
the log, the generators do it for the message.
