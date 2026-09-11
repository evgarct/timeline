import fs from 'fs';
import path from 'path';

const xcstringsPath = path.resolve('Form/Resources/Localizable.xcstrings');
const xcstrings = JSON.parse(fs.readFileSync(xcstringsPath, 'utf8'));

const androidResDir = path.resolve('android/app/src/main/res');

function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '\\"')
    .replace(/'/g, "\\'")
    .replace(/@/g, '\\@')
    .replace(/\n/g, '\\n');
}

const locales = [
  { code: 'en', dir: path.join(androidResDir, 'values') },
  { code: 'ru', dir: path.join(androidResDir, 'values-ru') },
  { code: 'cs', dir: path.join(androidResDir, 'values-cs') },
];

for (const loc of locales) {
  fs.mkdirSync(loc.dir, { recursive: true });
  let xml = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n';
  xml += '    <string name="app_name">Form</string>\n';

  for (const [key, item] of Object.entries(xcstrings.strings)) {
    const androidKey = key.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
    let val = '';
    if (item.localizations && item.localizations[loc.code] && item.localizations[loc.code].stringUnit) {
      val = item.localizations[loc.code].stringUnit.value;
    } else if (item.localizations && item.localizations['en'] && item.localizations['en'].stringUnit) {
      val = item.localizations['en'].stringUnit.value;
    } else if (item.value) {
      val = item.value;
    } else {
      val = key;
    }
    const hasPercent = val.includes('%');
    const formattedAttr = hasPercent ? ' formatted="false"' : '';
    xml += `    <string name="${androidKey}"${formattedAttr}>${escapeXml(val)}</string>\n`;
  }

  xml += '</resources>\n';
  fs.writeFileSync(path.join(loc.dir, 'strings.xml'), xml, 'utf8');
  console.log(`Wrote ${loc.code} strings to ${path.join(loc.dir, 'strings.xml')}`);
}
