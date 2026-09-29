import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distClientDir = path.join(rootDir, 'dist', 'client');
const distDir = path.join(rootDir, 'dist');
const serverEntry = path.join(rootDir, 'dist', 'server', 'server.js');

async function generateStaticHtml() {
  if (!fs.existsSync(distClientDir)) {
    fs.mkdirSync(distClientDir, { recursive: true });
  }

  let html = '';

  // Render via server handler
  if (fs.existsSync(serverEntry)) {
    try {
      const serverModule = await import(serverEntry);
      const handler = serverModule.default;
      if (handler && typeof handler.fetch === 'function') {
        const res = await handler.fetch(new Request('http://localhost/'));
        if (res && res.status === 200) {
          html = await res.text();
          console.log(`Rendered full static HTML (${html.length} bytes) via TanStack server.`);
        }
      }
    } catch (err) {
      console.warn('Server render failed, falling back to template:', err.message);
    }
  }

  // Fallback if server render failed
  if (!html) {
    const rootIndexHtml = path.join(rootDir, 'index.html');
    html = fs.readFileSync(rootIndexHtml, 'utf8');
    const assetsDir = path.join(distClientDir, 'assets');
    if (fs.existsSync(assetsDir)) {
      const allFiles = fs.readdirSync(assetsDir);
      const cssFile = allFiles.find(f => f.endsWith('.css'));
      const indexJs = allFiles.find(f => f.startsWith('index-') && f.endsWith('.js'));
      if (cssFile) {
        html = html.replace('</head>', `  <link rel="stylesheet" href="/assets/${cssFile}">\n</head>`);
      }
      if (indexJs) {
        html = html.replace(
          /<script type="module" src="\/src\/main\.tsx"><\/script>/,
          `<script type="module" async src="/assets/${indexJs}"></script>`
        );
      }
    }
  }

  // Invalidate any stale PWA Service Worker caches
  const cacheBusterScript = `
<script>
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(regs) {
    for (var i = 0; i < regs.length; i++) { regs[i].unregister(); }
  });
}
if (window.caches) {
  caches.keys().then(function(keys) {
    keys.forEach(function(k) { caches.delete(k); });
  });
}
</script>
`;

  if (!html.includes('caches.delete')) {
    html = html.replace('</body>', `${cacheBusterScript}\n</body>`);
  }

  // Write index.html and 404.html to dist/client and dist
  fs.writeFileSync(path.join(distClientDir, 'index.html'), html, 'utf8');
  fs.writeFileSync(path.join(distClientDir, '404.html'), html, 'utf8');
  fs.writeFileSync(path.join(distDir, 'index.html'), html, 'utf8');
  fs.writeFileSync(path.join(distDir, '404.html'), html, 'utf8');

  console.log('Successfully wrote index.html and 404.html to dist/client and dist!');
  process.exit(0);
}

generateStaticHtml().catch((err) => {
  console.error('Error generating static html:', err);
  process.exit(1);
});
