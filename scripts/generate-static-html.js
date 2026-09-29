import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distClientDir = path.join(rootDir, 'dist', 'client');
const distDir = path.join(rootDir, 'dist');

if (!fs.existsSync(distClientDir)) {
  fs.mkdirSync(distClientDir, { recursive: true });
}

// Find css and js files in dist/client/assets
const assetsDir = path.join(distClientDir, 'assets');
let cssFiles = [];
let jsFiles = [];

if (fs.existsSync(assetsDir)) {
  const allFiles = fs.readdirSync(assetsDir);
  cssFiles = allFiles.filter(f => f.endsWith('.css'));
  jsFiles = allFiles.filter(f => f.endsWith('.js'));
}

const rootIndexHtmlPath = path.join(rootDir, 'index.html');
let indexHtmlContent = fs.existsSync(rootIndexHtmlPath)
  ? fs.readFileSync(rootIndexHtmlPath, 'utf8')
  : '';

// Prepare CSS tags
const cssTags = cssFiles
  .map(f => `<link rel="stylesheet" href="/assets/${f}">`)
  .join('\n    ');

// Replace /src/main.tsx with actual assets if present or keep fallback
let finalHtml = indexHtmlContent;
if (cssTags && !finalHtml.includes('/assets/styles-')) {
  finalHtml = finalHtml.replace('</head>', `    ${cssTags}\n  </head>`);
}

// Write to dist/client/index.html and dist/client/404.html
fs.writeFileSync(path.join(distClientDir, 'index.html'), finalHtml, 'utf8');
fs.writeFileSync(path.join(distClientDir, '404.html'), finalHtml, 'utf8');

// Also write to dist/index.html and dist/404.html
fs.writeFileSync(path.join(distDir, 'index.html'), finalHtml, 'utf8');
fs.writeFileSync(path.join(distDir, '404.html'), finalHtml, 'utf8');

console.log('Successfully generated static index.html and 404.html for Firebase Hosting!');
