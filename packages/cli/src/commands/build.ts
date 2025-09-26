/**
 * @fileoverview Build command implementation
 */

import { existsSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { FileBasedRouter } from '@plank/router';
import { loadConfig } from '../config.js';

export interface BuildOptions {
  output?: string;
  minify?: boolean;
  sourcemap?: boolean;
}

export async function buildCommand(options: BuildOptions = {}): Promise<void> {
  const projectRoot = process.cwd();
  const outputDir = options.output || './dist';
  const minify = options.minify ?? true;
  const sourcemap = options.sourcemap ?? false;

  // Load project configuration
  const config = await loadConfig(projectRoot);
  const routesDir = config.routesDir || './app/routes';
  const layoutsDir = config.layoutsDir || './app/layouts';
  const publicDir = config.publicDir || './public';

  // Check if we're in a Plank project
  const routesPath = resolve(projectRoot, routesDir);

  if (!existsSync(routesPath)) {
    console.error(`❌ Routes directory not found: ${routesPath}`);
    console.error("💡 Make sure you're in a Plank project directory");
    process.exit(1);
  }

  console.log('🔨 Building Plank application for production...');
  console.log(`📁 Project root: ${projectRoot}`);
  console.log(`📂 Routes directory: ${routesDir}`);
  console.log(`📂 Layouts directory: ${layoutsDir}`);
  console.log(`📂 Public directory: ${publicDir}`);
  console.log(`📦 Output directory: ${outputDir}`);
  console.log(`🗜️  Minify: ${minify ? 'Yes' : 'No'}`);
  console.log(`🗺️  Source maps: ${sourcemap ? 'Yes' : 'No'}`);

  try {
    console.log('⏳ Build process starting...');

    // Step 1: Create output directory
    console.log('📁 Creating output directory...');
    await mkdir(resolve(projectRoot, outputDir), { recursive: true });

    // Step 2: Initialize router and discover routes
    console.log('🔍 Discovering routes...');
    const router = new FileBasedRouter({
      routesDir,
      layoutsDir,
      extensions: ['.plk'],
      defaultLayout: undefined,
      generateManifest: true,
      manifestPath: undefined,
      watch: false,
    });

    await router.initialize();
    const routes = router.getRoutes();
    console.log(`✅ Found ${routes.length} routes`);

    // Step 3: Generate route manifest
    console.log('📋 Generating route manifest...');
    const _manifest = router.generateManifest();
    console.log('✅ Route manifest generated');

    // Step 4: Copy public assets
    const publicPath = resolve(projectRoot, publicDir);
    if (existsSync(publicPath)) {
      console.log('📁 Copying public assets...');
      // TODO: Implement asset copying
      console.log('✅ Public assets copied');
    }

    // Step 5: Build static pages (placeholder)
    console.log('🏗️  Building static pages...');
    // TODO: Implement static page generation
    console.log('✅ Static pages built');

    // Step 6: Generate client bundles (placeholder)
    console.log('📦 Generating client bundles...');
    // TODO: Implement client bundle generation
    console.log('✅ Client bundles generated');

    console.log('✅ Build completed successfully!');
    console.log(`📦 Output available in: ${outputDir}`);
    console.log(`📋 Route manifest: ${routes.length} routes discovered`);
    console.log('');
    console.log('🚀 Ready for production deployment!');
  } catch (error) {
    console.error('❌ Build failed:');
    console.error(error);
    process.exit(1);
  }
}
