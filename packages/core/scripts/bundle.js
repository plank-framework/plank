#!/usr/bin/env node

/**
 * @fileoverview Bundle script for @plank/core
 * Bundles all the individual @plank/* packages into a single package
 */

import { copyFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const packagesDir = resolve(__dirname, '../../');

async function bundlePackage(packageName, outputFile) {
  const packageDir = join(packagesDir, packageName, 'dist');

  try {
    await build({
      entryPoints: [join(packageDir, 'index.js')],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile: outputFile,
      external: [
        'node:*',
        'lightningcss',
        'fsevents',
        'vite',
        'chokidar',
        'ws',
        'mime-types',
        'mime',
      ],
      banner: {
        js: `// Bundled from @plank/${packageName}\n`,
      },
    });
    console.log(`✅ Bundled ${packageName} -> ${outputFile}`);
  } catch (error) {
    console.error(`❌ Failed to bundle ${packageName}:`, error.message);
  }
}

async function copyTypeDefinitions(packageName, outputFile) {
  const packageDir = join(packagesDir, packageName, 'dist');
  const sourceFile = join(packageDir, 'index.d.ts');
  const destFile = outputFile.replace('.js', '.d.ts');

  try {
    await copyFile(sourceFile, destFile);
    console.log(`✅ Copied types for ${packageName} -> ${destFile}`);
  } catch (error) {
    console.error(`❌ Failed to copy types for ${packageName}:`, error.message);
  }
}

async function main() {
  console.log('🔨 Bundling @plank/core...');

  const distDir = resolve(__dirname, '../dist');
  await mkdir(distDir, { recursive: true });

  // Bundle each package
  const packages = ['compiler', 'router', 'ssr', 'dev-server', 'runtime-core', 'runtime-dom'];

  for (const packageName of packages) {
    const outputFile = join(distDir, `${packageName}.js`);
    await bundlePackage(packageName, outputFile);
    await copyTypeDefinitions(packageName, outputFile);
  }

  console.log('✅ @plank/core bundling complete!');
}

main().catch(console.error);
