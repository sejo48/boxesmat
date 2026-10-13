const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { spawn } = require('node:child_process');
const path = require('node:path');
let browser, server;
const base = 'http://127.0.0.1:8123';
before(async () => {
  server = spawn('python3', ['-m', 'http.server', '8123', '--bind', '127.0.0.1'], { cwd: path.resolve(__dirname, '..'), stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { const r = await fetch(base); if (r.ok) break; } catch {} await new Promise(r => setTimeout(r, 100)); }
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
});
after(async () => { if (browser) await browser.close(); if (server) server.kill(); });
async function page(width = 1920, height = 1080) {
  const context = await browser.newContext({ viewport: { width, height } });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    const file = url.pathname.split('/').pop();
    if (file === 'listaoficial.m3u') return route.fulfill({ contentType: 'text/plain', body: '#EXTM3U\n#EXTINF:-1 tvg-logo="" group-title="Pruebas",Canal de prueba\n' + base + '/tests/fixtures/remote-test.webm\n#EXTINF:-1 group-title="Otros",Segundo canal\n' + base + '/tests/fixtures/remote-test.webm\n' });
    if (['peliculas.json','peliculas2.json'].includes(file)) return route.fulfill({ json: [{ titulo: 'Película de prueba', url: base + '/tests/fixtures/remote-test.webm', descripcion: 'Contenido para comprobar el mando.' }] });
    if (['playlist.json','animados.json','tudum.json'].includes(file)) return route.fulfill({ json: [] });
    if (file === 'radios.json') return route.fulfill({ json: [{ id: 'test-radio', title: 'Radio de prueba', url: base + '/tests/fixtures/remote-test.wav' }] });
    if (url.origin === base && file === 'remote-test.webm') {
      const bytes = require('node:fs').readFileSync(path.join(__dirname, 'fixtures', file));
      const range = route.request().headers().range;
      const match = range && range.match(/bytes=(\d+)-(\d*)/);
      const start = match ? Number(match[1]) : 0;
      const end = match && match[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
      return route.fulfill({ status: match ? 206 : 200, contentType: 'video/webm', headers: {
        'accept-ranges': 'bytes', ...(match ? { 'content-range': `bytes ${start}-${end}/${bytes.length}` } : {})
      }, body: bytes.subarray(start, end + 1) });
    }
    if (url.origin === base) return route.continue();
    if (file === 'firebase-app.js') return route.fulfill({ contentType: 'application/javascript', body: 'export function initializeApp(){return {}}' });
    if (file === 'firebase-firestore.js') return route.fulfill({ contentType: 'application/javascript', body: 'export function getFirestore(){return {}}; export function doc(){return {}}; export async function getDoc(){return {exists:()=>false}}; export async function updateDoc(){}; export async function setDoc(){}' });
    return route.abort();
  });
  const p = await context.newPage();
  p.errors = []; p.on('pageerror', e => p.errors.push(e.message));
  await p.goto(base, { waitUntil: 'domcontentloaded' });
  await p.waitForFunction(() => document.activeElement?.textContent.includes('Comenzar Experiencia'));
  return p;
}
async function enter(p) {
  await p.keyboard.press('Enter');
  await p.waitForSelector('header');
  await p.waitForFunction(() => document.querySelectorAll('.card-glow').length > 0);
}
async function focus(p, locator) { await locator.focus(); await p.waitForTimeout(80); }
async function pressRemote(p, keyCode) { await p.evaluate(code => document.dispatchEvent(new KeyboardEvent('keydown', { keyCode: code, which: code, bubbles: true, cancelable: true })), keyCode); await p.waitForTimeout(120); }

test('TV startup, remote OK and all navigation sections without JavaScript errors', async () => {
  const p = await page(); await enter(p);
  assert.equal(await p.locator('nav[aria-label="Secciones"] button').count(), 11);
  assert.deepEqual(p.errors, []);
  await focus(p, p.locator('nav button').first());
  await p.keyboard.press('ArrowRight');
  assert.match(await p.locator('[data-tv-focus]').innerText(), /Películas/);
  await p.keyboard.press('Enter');
  assert.match(await p.locator('main').innerText(), /Película de prueba/);
  await pressRemote(p, 10009);
  assert.match(await p.locator('main').innerText(), /Explora|Inicio|TV EN VIVO|Hub|Película de prueba/i);
  await pressRemote(p, 461);
  assert.equal(new URL(p.url()).pathname, '/');
  await p.context().close();
});

test('screen keyboard edits React search with remote-only keys and cancels safely', async () => {
  const p = await page(); await enter(p);
  const input = p.getByPlaceholder('Buscar contenido...'); await focus(p, input);
  await p.keyboard.press('Enter'); await p.waitForSelector('.tv-keyboard');
  await p.keyboard.press('Enter'); // initial digit 1
  await focus(p, p.locator('.tv-keyboard button').filter({ hasText: /^Listo$/ }));
  await p.keyboard.press('Enter');
  assert.equal(await input.inputValue(), '1');
  await p.waitForFunction(() => !document.querySelector('.tv-keyboard'));
  assert.equal(await p.locator('.card-glow').count(), 0); // React handled the input, not only the DOM.
  await p.keyboard.press('Enter'); await p.waitForSelector('.tv-keyboard');
  await p.keyboard.press('Enter'); await pressRemote(p, 10009);
  assert.equal(await input.inputValue(), '1');
  assert.equal(await p.locator('.tv-keyboard').count(), 0);
  assert.equal(await input.evaluate(el => document.activeElement === el), true);
  await p.context().close();
});

test('dialog traps focus, Back closes it and restores the invoking button', async () => {
  const p = await page(); await enter(p);
  const trigger = p.getByTitle('Ver en Smart TV'); await focus(p, trigger);
  await p.keyboard.press('Enter'); await p.waitForSelector('[data-tv-dialog]');
  for (const key of ['ArrowRight','ArrowDown','ArrowLeft','Tab','ArrowUp']) {
    await p.keyboard.press(key);
    assert.equal(await p.evaluate(() => !!document.activeElement.closest('[data-tv-dialog]')), true);
  }
  await pressRemote(p, 461);
  await p.waitForFunction(() => !Array.from(document.querySelectorAll('[data-tv-dialog]')).some(el => el.getBoundingClientRect().width > 0));
  assert.equal(await trigger.evaluate(el => document.activeElement === el), true);
  await p.context().close();
});

test('card favorites are individually reachable and persist after reload', async () => {
  const p = await page(); await enter(p);
  const card = p.locator('.card-glow').filter({ hasText: 'Película de prueba' }).first();
  await focus(p, card); await p.keyboard.press('ArrowUp');
  // The nested favorite must be reachable from the card with the D-pad.
  assert.equal(await card.locator('button').evaluate(el => document.activeElement === el), true);
  assert.match(await p.locator('[data-tv-focus]').getAttribute('aria-label'), /favoritos/);
  await p.keyboard.press('Enter');
  const stored = await p.evaluate(() => JSON.parse(localStorage.getItem('boxplay_favs')));
  assert.equal(stored.length, 1);
  await p.reload(); await p.waitForFunction(() => document.activeElement?.textContent.includes('Comenzar Experiencia')); await enter(p);
  assert.match(await p.locator('.card-glow').filter({ hasText: 'Película de prueba' }).first().locator('button').getAttribute('aria-label'), /Quitar/);
  await p.context().close();
});

test('TV direct video responds to media keys, toolbar, category selection and fullscreen Back', async () => {
  const p = await page(); await enter(p);
  await focus(p, p.locator('nav button').filter({ hasText: /^TV$/ })); await p.keyboard.press('Enter');
  await p.waitForSelector('video');
  await p.waitForFunction(() => document.querySelector('video').readyState >= 2);
  await pressRemote(p, 19); assert.equal(await p.locator('video').evaluate(v => v.paused), true);
  await p.waitForFunction(() => { const v = document.querySelector('video'); return v.seekable.length && v.seekable.end(v.seekable.length - 1) >= 11; });
  await p.locator('video').evaluate(v => { v.currentTime = 1; });
  await p.waitForFunction(() => !document.querySelector('video').seeking);
  await pressRemote(p, 417); assert.ok(await p.locator('video').evaluate(v => v.currentTime) >= 10);
  await pressRemote(p, 412); assert.ok(await p.locator('video').evaluate(v => v.currentTime) <= 2);
  await pressRemote(p, 415); await p.waitForFunction(() => !document.querySelector('video').paused);
  await focus(p, p.getByRole('button', { name: 'Silenciar', exact: true })); await p.keyboard.press('Enter');
  assert.equal(await p.locator('video').evaluate(v => v.muted), true);
  await focus(p, p.getByRole('button', { name: 'Subir volumen', exact: true })); await p.keyboard.press('Enter');
  assert.equal(await p.locator('video').evaluate(v => v.volume), 1);
  await focus(p, p.getByRole('button', { name: 'Pantalla completa', exact: true })); await p.keyboard.press('Enter');
  await p.waitForFunction(() => !!document.fullscreenElement); await pressRemote(p, 10009);
  await p.waitForFunction(() => !document.fullscreenElement);
  assert.equal(await p.locator('video').count(), 1);
  const select = p.locator('main select'); await focus(p, select); await p.keyboard.press('Enter'); await p.keyboard.press('ArrowDown');
  assert.equal(await select.inputValue(), 'Pruebas');
  await pressRemote(p, 10009); assert.equal(await p.locator('video').count(), 1);
  await pressRemote(p, 10009); await p.waitForFunction(() => !document.querySelector('video'));
  assert.deepEqual(p.errors, []);
  await p.context().close();
});

test('subscription remains required; remote opens a masked PIN keyboard', async () => {
  const p = await page(); await enter(p);
  const card = p.locator('.card-glow').filter({ hasText: 'Película de prueba' }).first();
  await focus(p, card); await p.keyboard.press('Enter');
  const play = p.locator('main button').filter({ hasText: /Ver ahora/i }).first();
  await play.waitFor(); await focus(p, play); await p.keyboard.press('Enter');
  await p.getByText('Contenido Premium', { exact: true }).waitFor();
  assert.equal(await p.locator('video').count(), 0);
  await focus(p, p.getByPlaceholder('Ingresa tu correo electrónico')); await p.keyboard.press('Enter');
  await p.waitForSelector('.tv-keyboard');
  assert.equal(await p.locator('.tv-keyboard').count(), 1);
  await pressRemote(p, 461); await pressRemote(p, 461);
  await p.waitForFunction(() => !Array.from(document.querySelectorAll('[data-tv-dialog]')).some(el => el.getBoundingClientRect().width > 0));
  await pressRemote(p, 10009);
  await p.waitForFunction(() => document.activeElement?.getAttribute('data-tv-id')?.startsWith('card:'));
  // Exercise the same keyboard against a masked input without modifying subscription state.
  await p.evaluate(() => { const input = document.createElement('input'); input.type = 'password'; input.maxLength = 4; input.placeholder = 'PIN de prueba'; document.body.appendChild(input); input.focus(); });
  await p.keyboard.press('Enter'); await p.waitForSelector('.tv-keyboard');
  await p.keyboard.press('Enter');
  assert.equal(await p.locator('.tv-keyboard-value').innerText(), '•');
  for (let i = 0; i < 5; i++) await p.keyboard.press('Enter');
  assert.equal(await p.locator('.tv-keyboard-value').innerText(), '••••');
  await p.context().close();
});

test('radio media keys and range changes update React controls', async () => {
  const p = await page(); await enter(p);
  await focus(p, p.locator('nav button').filter({ hasText: /^Radio HD$/ })); await p.keyboard.press('Enter');
  await p.getByPlaceholder('Buscar emisora...').waitFor();
  await pressRemote(p, 19);
  assert.equal(await p.locator('main button').filter({ hasText: /^REPRODUCIR$/ }).count(), 1);
  await pressRemote(p, 415);
  await p.locator('main button').filter({ hasText: /^PAUSAR$/ }).waitFor();
  const volume = p.locator('main input[type="range"]');
  await focus(p, volume); await p.keyboard.press('ArrowLeft');
  assert.ok(Math.abs(Number(await volume.inputValue()) - 0.75) < 0.001);
  await p.waitForTimeout(120); // A rerender must retain the changed React value.
  assert.ok(Math.abs(Number(await volume.inputValue()) - 0.75) < 0.001);
  await pressRemote(p, 413);
  assert.equal(await p.locator('main button').filter({ hasText: /^REPRODUCIR$/ }).count(), 1);
  assert.deepEqual(p.errors, []);
  await p.context().close();
});

test('TV layout fits 1280x720 and optional desktop mode starts', async () => {
  const p = await page(1280, 720); await enter(p);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
  const header = await p.locator('header').boundingBox();
  const main = await p.locator('main').evaluate(el => parseFloat(getComputedStyle(el).paddingTop));
  assert.ok(main >= header.height, `main padding ${main}, header ${header.height}`);
  await p.goto(base + '/?tv=0', { waitUntil: 'domcontentloaded' });
  assert.equal(await p.locator('html').getAttribute('class'), '');
  await p.context().close();
});
