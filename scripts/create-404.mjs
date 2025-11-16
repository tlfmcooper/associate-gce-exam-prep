import { rm, copyFile } from 'node:fs/promises';
import path from 'node:path';

const distDir = path.resolve('dist');
const indexPath = path.join(distDir, 'index.html');
const notFoundPath = path.join(distDir, '404.html');

try {
  await rm(notFoundPath, { recursive: true, force: true });
  await copyFile(indexPath, notFoundPath);
  console.log('Created dist/404.html for GitHub Pages fallback');
} catch (error) {
  console.error('Failed to create 404.html:', error);
  process.exitCode = 1;
}
