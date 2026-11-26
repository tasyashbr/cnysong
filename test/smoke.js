// Quick checks that do not need Electron or network.
const assert = require('assert');
const { parseLrc, cleanTitle, firstArtist } = require('../src/lyrics');
const { romanizeLines } = require('../src/romanize');

(async () => {
  const lrc = '[ar:Someone]\n[00:12.30] Hello\n[00:17.5][01:02.05]World\n[01:30.00]\n';
  const p = parseLrc(lrc);
  assert.deepStrictEqual(p.map((x) => x.t), [12300, 17500, 62050, 90000]);
  assert.strictEqual(p[0].text, 'Hello');
  assert.strictEqual(p[3].text, '');
  assert.strictEqual(cleanTitle('Song (feat. X) - 2011 Remaster'), 'Song');
  assert.strictEqual(firstArtist('A, B & C'), 'A');

  const r = await romanizeLines([
    { t: 0, text: 'Hello there' },
    { t: 1, text: '夜に駆ける' },
    { t: 2, text: '사랑해요 안녕하세요' },
    { t: 4, text: 'Привет, мир' },
    { t: 5, text: 'สวัสดีครับ' }
  ]);
  r.lines.forEach((l) => console.log(JSON.stringify(l.text), '=>', JSON.stringify(l.rom)));
  const zh = await romanizeLines([{ t: 0, text: '你好，我爱你' }]);
  console.log('zh =>', zh.lines[0].rom);
  assert.ok(/n[iǐ]/.test(zh.lines[0].rom));
  assert.strictEqual(r.lines[0].rom, null);
  assert.ok(r.lines[1].rom && /yoru/i.test(r.lines[1].rom));
  assert.ok(r.hasRomanization);
  console.log('smoke ok');
})().catch((e) => { console.error(e); process.exit(1); });
