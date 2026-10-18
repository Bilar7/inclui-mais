// Inclui+ · construção
//   npm run build   →  index.html + app.js que abrem com duplo clique (file://) e em qualquer servidor
//                      dist-artifact/  → versão alojável numa única página (link do claude.ai)
// A fonte de verdade é dev.html + js/ (módulos ES). Requer esbuild (npm i -D esbuild).
import { readFile, writeFile, mkdir, copyFile, readdir, unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname, basename } from 'node:path';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const esbuild = await import('esbuild').catch(() => import(process.env.ESBUILD_PATH || '/opt/npm-tools/node_modules/esbuild/lib/main.js'));

// "three" e "three/addons/..." apontam para a cópia local em vendor/; módulos https:// ficam externos (MediaPipe)
const resolver = {
  name: 'inclui-resolver',
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: join(ROOT, 'vendor/three/three.module.js') }));
    b.onResolve({ filter: /^three\/addons\// }, (a) => ({ path: join(ROOT, 'vendor/three/addons', a.path.slice('three/addons/'.length)) }));
    b.onResolve({ filter: /^https?:\/\// }, (a) => ({ path: a.path, external: true }));
  },
};
const result = await esbuild.build({
  entryPoints: [join(ROOT, 'js/main.js')], bundle: true, format: 'iife', target: ['es2020'], minify: true,
  legalComments: 'none', write: false, plugins: [resolver], logLevel: 'warning',
});
const appJs = '/*! Inclui+ · Bilar DigitalTech Solutions · inclui Three.js (MIT) */\n' + result.outputFiles[0].text;
await writeFile(join(ROOT, 'app.js'), appJs);

// catálogo e modelos embutidos (para file:// e alojamentos que só servem ficheiros web comuns):
// cada .glb vira partes .glb.N.js em base64 com no máximo ~8 MB (limite por ficheiro de vários alojamentos)
const PART = 8 * 1024 * 1024; // múltiplo de 4: as partes juntam-se sem estragar o base64
const catalog = JSON.parse(await readFile(join(ROOT, 'assets/avatars/avatars.json'), 'utf8'));
const partFiles = [];
for (const m of catalog.models) for (const f of new Set(Object.values(m.files))) {
  const src = join(ROOT, 'assets/avatars', f);
  if (!existsSync(src)) continue;
  const dir = dirname(src);
  for (const old of await readdir(dir)) if (old.startsWith(f.split('/').pop() + '.') && old.endsWith('.js')) await unlink(join(dir, old));
  const b64 = (await readFile(src)).toString('base64'), n = Math.ceil(b64.length / PART);
  for (let i = 0; i < n; i++) {
    await writeFile(`${src}.${i}.js`, `(window.__INCLUI_GLB||(window.__INCLUI_GLB={}))[${JSON.stringify(f + '#' + i)}]="${b64.slice(i * PART, (i + 1) * PART)}";\n`);
    partFiles.push(`assets/avatars/${f}.${i}.js`);
  }
  m.parts = n;
}
await writeFile(join(ROOT, 'assets/avatars/avatars.js'), `window.__INCLUI_CATALOG=${JSON.stringify(catalog)};\n`);

// index.html = dev.html sem módulos (scripts clássicos funcionam com duplo clique)
const dev = await readFile(join(ROOT, 'dev.html'), 'utf8');
const html = dev
  .replace(/\s*<script type="importmap">[\s\S]*?<\/script>/, '')
  .replace(/<script type="module" src="js\/main\.js"><\/script>/, '<script src="assets/avatars/avatars.js"></script>\n  <script src="app.js" defer></script>')
  .replace('<title>Inclui+</title>', '<title>Inclui+</title>\n  <!-- Ficheiro gerado por tools/build.mjs a partir de dev.html. Edite dev.html e js/. -->');
await writeFile(join(ROOT, 'index.html'), html);

// versão de página única para alojar no claude.ai (sem <html>/<head>/<body>; CSS, JS e imagens embutidos; modelos em partes)
const dataUri = async (f, type) => `data:${type};base64,${(await readFile(join(ROOT, f))).toString('base64')}`;
let css = (await readFile(join(ROOT, 'css/app.css'), 'utf8'));
for (const f of ['hero.jpg', 'hero-m.jpg']) if (existsSync(join(ROOT, 'assets/brand', f))) css = css.replace(`url("../assets/brand/${f}")`, `url("${await dataUri('assets/brand/' + f, 'image/jpeg')}")`);
css = css.replace(/url\("\.\.\/assets\//g, 'url("assets/');
let body = dev.slice(dev.indexOf('<body>') + 6, dev.lastIndexOf('</body>'));
for (const f of ['assets/brand/logo-full.png', 'assets/brand/badge.png']) body = body.split(`src="${f}"`).join(`src="${await dataUri(f, 'image/png')}"`);
const artModels = structuredClone(catalog.models).filter((m) => m.kind === 'standard' || m.kind === 'realistic');
for (const m of artModels) { const t = 'assets/avatars/thumbs/' + basename(m.files.desktop, '.glb') + '.jpg'; if (existsSync(join(ROOT, t))) m.thumb = await dataUri(t, 'image/jpeg'); }
const fonts = dev.match(/<link rel="stylesheet" href="(https:\/\/fonts[^"]+)">/)[1];
const art = `<title>Inclui+</title>
<link rel="stylesheet" href="${fonts}">
<style>${css}</style>
${body.replace(/\s*<script[\s\S]*?<\/script>/g, '')}
<script>window.__INCLUI_EMBED=true;window.__INCLUI_CATALOG=${JSON.stringify({ models: artModels })};</script>
<script>${appJs.replace(/<\/script/gi, '<\\/script')}</script>
`;
const out = join(ROOT, 'dist-artifact');
const { rm } = await import('node:fs/promises'); await rm(out, { recursive: true, force: true });
await mkdir(join(out, 'assets/avatars/standard'), { recursive: true }); await mkdir(join(out, 'assets/avatars/realistic'), { recursive: true });
await writeFile(join(out, 'inclui.html'), art);
const artParts = partFiles.filter((f) => artModels.some((m) => Object.values(m.files).some((x) => f.startsWith('assets/avatars/' + x + '.'))));
for (const f of artParts) await copyFile(join(ROOT, f), join(out, f));
await writeFile(join(out, 'files.json'), JSON.stringify(artParts));
console.log(`✓ app.js ${(appJs.length / 1e6).toFixed(2)} MB · index.html · ${partFiles.length} partes de modelos · dist-artifact/inclui.html ${(art.length / 1e6).toFixed(2)} MB`);
