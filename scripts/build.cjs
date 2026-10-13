const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const babel = require(path.join(root, 'assets/vendor/babel.js'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const match = html.match(/<script type="text\/boxplay-source">([\s\S]*?)<\/script>/);
if (!match) throw new Error('Missing application source');
const compiled = babel.transform(match[1], {
  presets: [['env', { targets: { chrome: '60' }, modules: false }], ['react', { runtime: 'classic' }]],
  comments: false,
  compact: true
});
fs.writeFileSync(path.join(root, 'assets/app.js'), compiled.code + '\n');
execFileSync(process.execPath, [require.resolve('tailwindcss/lib/cli.js'), '-i', 'assets/tailwind-input.css', '--content', './index.html', '-o', 'assets/tailwind.css', '--minify'], { cwd: root, stdio: 'inherit' });
console.log('Built app.js and tailwind.css');
