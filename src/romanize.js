// Converts lyric lines to a Latin-script reading. Returns null for a line that is already Latin.
const path = require('path');

const RE = {
  kana: /[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9f]/,
  hangul: /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/,
  han: /[\u4e00-\u9fff\u3400-\u4dbf]/,
  // any letter that is not Latin
  nonLatin: /[^\u0000-\u024f\u1e00-\u1eff\s\d\p{P}\p{S}]/u
};

let kuroshiro = null;
let kuroshiroReady = null;
function getKuroshiro() {
  if (kuroshiroReady) return kuroshiroReady;
  kuroshiroReady = (async () => {
    const K = require('kuroshiro');
    const Kuroshiro = K.default || K;
    const KuromojiAnalyzer = require('kuroshiro-analyzer-kuromoji');
    let dictPath = path.join(path.dirname(require.resolve('kuromoji/package.json')), 'dict');
    dictPath = dictPath.replace('app.asar' + path.sep, 'app.asar.unpacked' + path.sep); // packaged app
    kuroshiro = new Kuroshiro();
    await kuroshiro.init(new KuromojiAnalyzer({ dictPath }));
    return kuroshiro;
  })();
  kuroshiroReady.catch(() => { kuroshiroReady = null; }); // retry if failed
  return kuroshiroReady;
}

function korean(text) {
  const H = require('hangul-romanization');
  const fn = H.convert || (H.default && H.default.convert);
  return fn.call(H.default || H, text);
}
function chinese(text) {
  const { pinyin } = require('pinyin-pro');
  return pinyin(text, { toneType: 'symbol', type: 'string' });
}
function generic(text) {
  const { transliterate } = require('transliteration');
  return transliterate(text);
}
async function japanese(text) {
  const k = await getKuroshiro();
  return k.convert(text, { to: 'romaji', mode: 'spaced', romajiSystem: 'hepburn' });
}

const FULLWIDTH = { '\uff0c': ',', '\u3001': ',', '\u3002': '.', '\uff01': '!', '\uff1f': '?', '\uff1b': ';', '\uff1a': ':' };
function tidy(s) {
  return s
    .replace(/[\uff0c\u3001\u3002\uff01\uff1f\uff1b\uff1a]/g, (c) => FULLWIDTH[c])
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim();
}

// lines: [{ t, text }] -> same array with .rom added (string or null)
async function romanizeLines(lines) {
  const all = lines.map((l) => l.text).join('\n');
  const songHasKana = RE.kana.test(all);
  let any = false;
  let failed = false;

  const out = [];
  for (const l of lines) {
    const text = l.text;
    let rom = null;
    try {
      if (!text || !RE.nonLatin.test(text)) rom = null;
      else if (RE.kana.test(text) || (RE.han.test(text) && songHasKana)) rom = await japanese(text);
      else if (RE.hangul.test(text)) rom = korean(text);
      else if (RE.han.test(text)) rom = chinese(text);
      else rom = generic(text);
    } catch (e) {
      rom = null;
      if (!failed) console.error('[romanize] failed:', e.message);
      failed = true;
    }
    if (rom) { rom = tidy(rom); any = true; }
    out.push({ ...l, rom });
  }
  return { lines: out, hasRomanization: any, failed };
}

module.exports = { romanizeLines };
