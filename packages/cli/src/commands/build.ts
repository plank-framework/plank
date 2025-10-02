/**
 * @fileoverview Build command implementation
 */

import { existsSync } from 'node:fs';
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { compile } from '@plank/compiler';
import type { RouteConfig } from '@plank/router';
import { FileBasedRouter } from '@plank/router';
import { SSRRenderer } from '@plank/ssr';
import { loadConfig, type PlankConfig } from '../config.js';

export interface BuildOptions {
  output?: string;
  minify?: boolean;
  sourcemap?: boolean;
}

interface IslandInfo {
  name: string;
  path: string;
  size: number;
}

type DirectiveType = 'event' | 'bind' | 'class' | 'x:if' | 'x:for';

interface Directive {
  type: DirectiveType;
  attribute: string;
  expression: string;
  element: string;
  selector: string;
  isCheckbox?: boolean;
  index: number;
}

interface TextBinding {
  expression: string;
  selector: string;
}

interface ForLoop {
  itemVar: string;
  itemsVar: string;
  keyExpr?: string;
  template: string;
  originalTemplate: string;
  containerTag: string;
  index: number;
}

interface ScriptContent {
  content: string;
}

interface CompileResult {
  scripts: ScriptContent[];
}

interface DirectiveMatches {
  on?: [string, string, string | null] | null;
  bind?: [string, string, string | null] | null;
  class?: [string, string, string | null] | null;
  xIf?: [string | null, string] | null;
  xFor?: [string | null, string] | null;
}

export async function buildCommand(options: BuildOptions = {}): Promise<void> {
  const projectRoot = process.cwd();
  const config = await loadConfig(projectRoot);
  const outputDir = options.output || config.outputDir || './dist';
  const minify = options.minify ?? true;
  const sourcemap = options.sourcemap ?? false;

  logBuildInfo(projectRoot, config, outputDir, minify, sourcemap);

  try {
    await mkdir(outputDir, { recursive: true });

    const routes = await discoverRoutes(config);
    await generateRouteManifest(routes, outputDir);
    await copyPublicAssets(projectRoot, config, outputDir);
    await buildStaticPages(routes, projectRoot, config, outputDir);
    const islands = await buildClientBundles(projectRoot, config, outputDir, sourcemap);
    await setupRuntimeFiles(projectRoot, outputDir);
    await generateIslandsManifest(islands, outputDir);

    logBuildSuccess(outputDir, routes.length);
  } catch (error) {
    console.error('❌ Build failed:');
    console.error(error);
    process.exit(1);
  }
}

function logBuildInfo(
  projectRoot: string,
  config: PlankConfig,
  outputDir: string,
  minify: boolean,
  sourcemap: boolean
): void {
  console.log('🔨 Building Plank application for production...');
  console.log(`📁 Project root: ${projectRoot}`);
  console.log(`📂 Routes directory: ${config.routesDir}`);
  console.log(`📂 Layouts directory: ${config.layoutsDir}`);
  console.log(`📂 Public directory: ${config.publicDir}`);
  console.log(`📦 Output directory: ${outputDir}`);
  console.log(`🗜️  Minify: ${minify ? 'Yes' : 'No'}`);
  console.log(`🗺️  Source maps: ${sourcemap ? 'Yes' : 'No'}`);
  console.log('⏳ Build process starting...');
}

async function discoverRoutes(config: PlankConfig) {
  console.log('🔍 Discovering routes...');
  const router = new FileBasedRouter({
    routesDir: config.routesDir || './app/routes',
    layoutsDir: config.layoutsDir || './app/layouts',
    extensions: ['.plk'],
    defaultLayout: undefined,
    generateManifest: false,
    manifestPath: undefined,
    watch: false,
  });

  await router.initialize();
  const routes = router.getRoutes();
  console.log(`✅ Found ${routes.length} routes`);
  return routes;
}

async function generateRouteManifest(routes: RouteConfig[], outputDir: string): Promise<void> {
  console.log('📋 Generating route manifest...');
  const manifest = {
    routes: routes.map((route) => ({
      path: route.path,
      file: route.pagePath,
      layout: route.layoutPath,
    })),
    generatedAt: new Date().toISOString(),
  };

  await writeFile(join(outputDir, 'routes.json'), JSON.stringify(manifest, null, 2));
  console.log('✅ Route manifest generated');
}

async function copyPublicAssets(
  projectRoot: string,
  config: PlankConfig,
  outputDir: string
): Promise<void> {
  const publicPath = resolve(projectRoot, config.publicDir || './public');
  if (existsSync(publicPath)) {
    console.log('📁 Copying public assets...');
    const publicFiles = await readdir(publicPath);
    for (const file of publicFiles) {
      await copyFile(join(publicPath, file), join(outputDir, file));
    }
    console.log('✅ Public assets copied');
  }
}

async function buildStaticPages(
  routes: RouteConfig[],
  projectRoot: string,
  config: PlankConfig,
  outputDir: string
): Promise<void> {
  console.log('🏗️  Building static pages...');
  const renderer = new SSRRenderer({
    templateDir: projectRoot,
    assetsDir: config.publicDir || './public',
    baseUrl: '/',
    streaming: false,
  });

  for (const route of routes) {
    try {
      const context = {
        url: route.path,
        method: 'GET',
        headers: {},
        params: {},
        query: {},
        data: {},
      };
      const result = await renderer.render(route.pagePath, context, route.layoutPath);
      let html = result.html;

      // Fix import paths for production build
      html = html.replace(
        /\/node_modules\/@plank\/runtime-dom\/dist\/index\.js/g,
        'islands/runtime.js'
      );

      const outputPath = route.path === '/' ? 'index.html' : `${route.path.slice(1)}.html`;
      await writeFile(join(outputDir, outputPath), html);
    } catch (error) {
      console.error(`❌ Failed to render route ${route.path}:`, error);
    }
  }
  console.log('✅ Static pages built');
}

async function buildClientBundles(
  projectRoot: string,
  config: PlankConfig,
  outputDir: string,
  sourcemap: boolean
): Promise<IslandInfo[]> {
  console.log('📦 Generating client bundles...');

  const islandsDir = resolve(projectRoot, config.routesDir || './app/routes', '../islands');
  const islands: IslandInfo[] = [];

  if (existsSync(islandsDir)) {
    const islandFiles = await readdir(islandsDir);
    const jsFiles = islandFiles.filter((file) => file.endsWith('.plk'));

    for (const file of jsFiles) {
      const filePath = join(islandsDir, file);
      const content = await readFile(filePath, 'utf-8');

      const result = compile(content, {
        filename: filePath,
        sourceMap: sourcemap,
      });

      const islandCode = generateIslandModule(result, content);
      const outputPath = join(outputDir, 'islands', file.replace('.plk', '.js'));

      await mkdir(join(outputDir, 'islands'), { recursive: true });
      await writeFile(outputPath, islandCode);

      const stats = await import('node:fs').then((fs) => fs.promises.stat(outputPath));
      islands.push({
        name: file.replace('.plk', '.js'),
        path: `islands/${file.replace('.plk', '.js')}`,
        size: stats.size,
      });

      console.log(`  ✅ Compiled island: ${file.replace('.plk', '.js')}`);
    }
  }

  return islands;
}

async function setupRuntimeFiles(projectRoot: string, outputDir: string): Promise<void> {
  const runtimeDomSource = resolve(projectRoot, 'node_modules/@plank/runtime-dom/dist');
  const runtimeCoreSource = resolve(projectRoot, 'node_modules/@plank/runtime-core/dist');
  const runtimeDest = join(outputDir, 'islands', 'runtime');

  await mkdir(runtimeDest, { recursive: true });

  // Copy runtime-dom files and fix imports
  if (existsSync(runtimeDomSource)) {
    const runtimeDomFiles = await readdir(runtimeDomSource);
    for (const file of runtimeDomFiles) {
      if (file.endsWith('.js')) {
        let content = await readFile(join(runtimeDomSource, file), 'utf-8');
        content = content.replace(/@plank\/runtime-core/g, './signals.js');
        await writeFile(join(runtimeDest, file), content);
      }
    }
  }

  // Copy runtime-core files
  if (existsSync(runtimeCoreSource)) {
    const runtimeCoreFiles = await readdir(runtimeCoreSource);
    for (const file of runtimeCoreFiles) {
      if (file.endsWith('.js')) {
        await copyFile(join(runtimeCoreSource, file), join(runtimeDest, file));
      }
    }
  }

  // Fix the index.js file to export all runtime modules
  const indexPath = join(runtimeDest, 'index.js');
  if (existsSync(indexPath)) {
    const indexContent = `/**
 * @fileoverview Plank DOM binding runtime
 * Connects signals to DOM elements for reactive updates
 */
export { batch, computed, effect, signal } from './signals.js';
export * from './actions.js';
export * from './bindings.js';
export * from './directives.js';
export * from './dom-ir.js';
export * from './focus-management.js';
export * from './islands.js';
export * from './router-integration.js';
export * from './view-transitions.js';
`;
    await writeFile(indexPath, indexContent);
  }

  // Create a bundled runtime file that resolves all imports
  const bundledRuntime = `/**
 * @fileoverview Bundled Plank runtime for browser
 */
import { batch, computed, effect, signal } from './runtime/signals.js';
export { batch, computed, effect, signal };

// Re-export all runtime-dom functionality
export * from './runtime/actions.js';
export * from './runtime/bindings.js';
export * from './runtime/directives.js';
export * from './runtime/dom-ir.js';
export * from './runtime/focus-management.js';
export * from './runtime/islands.js';
export * from './runtime/router-integration.js';
export * from './runtime/view-transitions.js';
`;

  await writeFile(join(outputDir, 'islands', 'runtime.js'), bundledRuntime);
  console.log('✅ Client bundles generated');
}

async function generateIslandsManifest(islands: IslandInfo[], outputDir: string): Promise<void> {
  const islandsManifest = {
    runtime: 'islands/runtime.js',
    islands,
  };

  await writeFile(join(outputDir, 'islands.json'), JSON.stringify(islandsManifest, null, 2));
}

function logBuildSuccess(outputDir: string, routeCount: number): void {
  console.log('✅ Build completed successfully!');
  console.log(`📦 Output available in: ${outputDir}`);
  console.log(`📋 Route manifest: ${routeCount} routes discovered`);
  console.log('');
  console.log('🚀 Ready for production deployment!');
}

/**
 * Generate island module code
 */
function generateIslandModule(result: CompileResult, originalContent: string): string {
  const htmlContent = extractHTMLFromPlk(originalContent);
  const scriptsCode = generateScriptsSection(result.scripts);
  const mountCode = generateMountFunction(originalContent, result.scripts);

  return `${scriptsCode}// Island template
const template = ${JSON.stringify(htmlContent)};

${mountCode}

// Default export
export default {
  mount,
  template,
};
`;
}

/**
 * Extract HTML content from .plk file
 */
function extractHTMLFromPlk(content: string): string {
  // Remove script tags and their content
  let html = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Keep style tags - they will be injected into the DOM with the template
  // No need to remove them, the browser will apply them when innerHTML is set

  // Remove x:for elements entirely (they will be handled by JavaScript)
  html = html.replace(/<(\w+)([^>]*x:for=[^>]*)>([\s\S]*?)<\/\1>/gi, '');

  // Remove directive attributes using proper brace matching
  html = stripDirectives(html);

  // Clean up any remaining script-related content and return the HTML
  return html.trim();
}

/**
 * Strip directive attributes from HTML content
 */
function stripDirectives(html: string): string {
  // Remove directive attributes while preserving other attributes
  let result = html
    .replace(/\s+on:\w+=\{[^}]+\}/g, '') // Remove on:* directives
    .replace(/\s+bind:\w+=\{[^}]+\}/g, '') // Remove bind:* directives
    .replace(/\s+class:\w+=\{[^}]+\}/g, '') // Remove class:* directives
    .replace(/\s+x:if=\{[^}]+\}/g, '') // Remove x:if directives
    .replace(/\s+x:for=\{[^}]+\}/g, '') // Remove x:for directives
    .replace(/\s+x:key=\{[^}]+\}/g, ''); // Remove x:key directives

  // Remove text interpolations like {expression} but preserve CSS rules in <style> blocks
  // First, protect <style> blocks from text interpolation removal
  const styleBlocks: string[] = [];
  result = result.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_match, content) => {
    styleBlocks.push(content);
    return `<style>__STYLE_BLOCK_${styleBlocks.length - 1}__</style>`;
  });

  // Remove text interpolations from non-style content
  result = result.replace(/\{[^}]+\}/g, '');

  // Restore <style> blocks with their original content
  result = result.replace(/<style>__STYLE_BLOCK_(\d+)__<\/style>/g, (_match, index) => {
    return `<style>${styleBlocks[parseInt(index, 10)]}</style>`;
  });

  return result;
}

/**
 * Extract x:for loop directives with their templates
 */
function extractForLoops(html: string): Array<{
  itemVar: string;
  itemsVar: string;
  keyExpr?: string;
  template: string;
  originalTemplate: string;
  containerTag: string;
  index: number;
}> {
  const loops: Array<{
    itemVar: string;
    itemsVar: string;
    keyExpr?: string;
    template: string;
    originalTemplate: string;
    containerTag: string;
    index: number;
  }> = [];

  // Match x:for elements with their full content
  const forRegex = /<(\w+)([^>]*x:for=\{([^}]+)\}[^>]*)>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null = forRegex.exec(html);
  let loopIndex = 0;

  while (match !== null) {
    const tag = match[1];
    const attrs = match[2];
    const forExpr = match[3];
    const innerHtml = match[4];

    // Parse x:for="item of items()" syntax
    const forMatch = forExpr?.trim().match(/^(\w+)\s+of\s+(.+)$/);
    if (forMatch?.[1] && forMatch[2] && tag) {
      const itemVar = forMatch[1];
      const itemsVar = forMatch[2];

      // Extract x:key if present
      const keyMatch = attrs?.match(/x:key=\{([^}]+)\}/);
      const keyExpr = keyMatch?.[1];

      // Store ORIGINAL template with directives for binding extraction
      const originalTemplate = `<${tag}${attrs}>${innerHtml || ''}</${tag}>`;

      // Clean directive attributes from template for rendering
      let cleanedAttrs = attrs || '';
      cleanedAttrs = cleanedAttrs.replace(/\s+x:(for|key)=\{[^}]+\}/gi, '');
      const cleanedInner = stripDirectives(innerHtml || '');
      const cleanedTemplate = `<${tag}${cleanedAttrs}>${cleanedInner}</${tag}>`;

      // Determine the container element (parent of the x:for element)
      // We'll use the parent container as the target for dynamic insertion

      const loopData: {
        itemVar: string;
        itemsVar: string;
        keyExpr?: string;
        template: string;
        originalTemplate: string;
        containerTag: string;
        index: number;
      } = {
        itemVar,
        itemsVar,
        template: cleanedTemplate,
        originalTemplate,
        containerTag: 'ul', // Use the parent container (ul) instead of the x:for element (li)
        index: loopIndex++,
      };

      // Only add keyExpr if it exists (exactOptionalPropertyTypes)
      if (keyExpr) {
        loopData.keyExpr = keyExpr;
      }

      loops.push(loopData);
    }

    match = forRegex.exec(html);
  }

  return loops;
}

/**
 * Generate x:for loop rendering code
 */
function generateForLoopBindings(loops: ForLoop[]): string {
  if (loops.length === 0) return '';

  const lines: string[] = [];
  lines.push('');
  lines.push('  // x:for list rendering');

  for (const loop of loops) {
    const { itemVar, itemsVar, keyExpr, template, originalTemplate, containerTag, index } = loop;

    lines.push(`  {`);
    lines.push(`    // Find the parent container (where x:for elements will be inserted)`);
    lines.push(`    const containers = element.querySelectorAll('${containerTag}');`);
    lines.push(`    const targetContainer = containers[${index}];`);
    lines.push(`    if (targetContainer) {`);
    lines.push(`      const itemTemplate = ${JSON.stringify(template)};`);
    lines.push(`      const renderedItems = new Map(); // Track rendered items by key`);
    lines.push(`      `);
    lines.push(`      effects.push(effect(() => {`);
    lines.push(`        const items = ${itemsVar};`);
    lines.push(`        if (!Array.isArray(items)) return;`);
    lines.push(`        `);
    lines.push(`        // Create map of new items by key`);
    lines.push(`        const newKeys = new Set();`);
    lines.push(`        const itemElements = [];`);
    lines.push(`        `);
    lines.push(`        for (const ${itemVar} of items) {`);

    if (keyExpr) {
      lines.push(`          const key = String(${keyExpr});`);
      lines.push(`          newKeys.add(key);`);
      lines.push(`          `);
      lines.push(`          // Reuse existing element if key matches, otherwise create new`);
      lines.push(`          let itemEl = renderedItems.get(key);`);
      lines.push(`          let isNewElement = false;`);
      lines.push(`          if (!itemEl) {`);
      lines.push(`            // Create new element from template`);
      lines.push(`            const temp = document.createElement('div');`);
      lines.push(`            temp.innerHTML = itemTemplate;`);
      lines.push(`            itemEl = temp.firstElementChild;`);
      lines.push(`            renderedItems.set(key, itemEl);`);
      lines.push(`            isNewElement = true;`);
      lines.push(`          }`);
      lines.push(`          `);
      lines.push(
        `          // Always update bindings (text and listeners) with current loop values`
      );

      const itemBindings = generateLoopItemBindingLines(loop, originalTemplate);
      for (const binding of itemBindings) {
        lines.push(`          ${binding}`);
      }

      lines.push(`          itemElements.push(itemEl);`);
    } else {
      // No keying - just recreate all elements
      lines.push(`          const temp = document.createElement('div');`);
      lines.push(`          temp.innerHTML = itemTemplate;`);
      lines.push(`          const itemEl = temp.firstElementChild;`);
      lines.push(`          `);
      lines.push(`          // Bind directives and interpolations`);

      const itemBindings = generateLoopItemBindingLines(loop, originalTemplate);
      for (const binding of itemBindings) {
        lines.push(`          ${binding}`);
      }

      lines.push(`          itemElements.push(itemEl);`);
    }

    lines.push(`        }`);
    lines.push(`        `);

    if (keyExpr) {
      lines.push(`        // Remove items that are no longer in the list`);
      lines.push(`        for (const [key, itemEl] of renderedItems) {`);
      lines.push(`          if (!newKeys.has(key)) {`);
      lines.push(`            if (itemEl && itemEl.parentNode) {`);
      lines.push(`              itemEl.parentNode.removeChild(itemEl);`);
      lines.push(`            }`);
      lines.push(`            renderedItems.delete(key);`);
      lines.push(`          }`);
      lines.push(`        }`);
      lines.push(`        `);
      lines.push(`                // Insert/update items in correct order`);
      lines.push(`        for (let i = 0; i < itemElements.length; i++) {`);
      lines.push(`          const itemEl = itemElements[i];`);
      lines.push(`          if (itemEl && itemEl.parentNode !== targetContainer) {`);
      lines.push(`            // Insert items in order`);
      lines.push(`            if (i === 0) {`);
      lines.push(`              // First item: clear container and insert`);
      lines.push(`              targetContainer.innerHTML = '';`);
      lines.push(`            }`);
      lines.push(`            targetContainer.appendChild(itemEl);`);
      lines.push(`          }`);
      lines.push(`        }`);
    } else {
      // No keying - replace all elements
      lines.push(`        // Clear container and append all new items`);
      lines.push(`        targetContainer.innerHTML = '';`);
      lines.push(`        for (const itemEl of itemElements) {`);
      lines.push(`          targetContainer.appendChild(itemEl);`);
      lines.push(`        }`);
    }

    lines.push(`      }));`);
    lines.push(`    }`);
    lines.push(`  }`);
  }

  return lines.join('\n');
}

/**
 * Extract text interpolation bindings from a loop template
 */
function extractLoopTextBindings(template: string, itemVar: string): string[] {
  const lines: string[] = [];
  const interpolationRegex = /<span[^>]*>([^<]*\{([^}]+)\}[^<]*)<\/span>/g;
  let spanIndex = 0;
  let interpMatch: RegExpExecArray | null = interpolationRegex.exec(template);

  while (interpMatch !== null) {
    const expr = interpMatch[2];

    if (expr?.includes(itemVar)) {
      lines.push(`const span${spanIndex} = itemEl?.querySelectorAll?.('span')?.[${spanIndex}];`);
      lines.push(`if (span${spanIndex}) span${spanIndex}.textContent = String(${expr});`);
      spanIndex++;
    }

    interpMatch = interpolationRegex.exec(template);
  }

  return lines;
}

/**
 * Extract event handler bindings from a loop template
 */
function extractLoopEventBindings(template: string, itemVar: string): string[] {
  const lines: string[] = [];
  let searchPos = 0;
  let buttonIndex = 0;

  while (true) {
    const onClickIdx = template.indexOf('on:click={', searchPos);
    if (onClickIdx === -1) break;

    // Find matching closing brace
    const braceStart = onClickIdx + 9; // 'on:click={'.length - 1
    let braceCount = 1;
    let endIdx = braceStart + 1;

    while (endIdx < template.length && braceCount > 0) {
      if (template[endIdx] === '{') braceCount++;
      if (template[endIdx] === '}') braceCount--;
      endIdx++;
    }

    const handler = template.substring(braceStart + 1, endIdx - 1);

    if (handler?.includes(itemVar)) {
      lines.push(
        `const btn${buttonIndex} = itemEl?.querySelectorAll?.('button')?.[${buttonIndex}];`
      );
      lines.push(`if (btn${buttonIndex}) {`);
      // Remove old listener if it exists
      lines.push(
        `  if (btn${buttonIndex}._plkHandler) btn${buttonIndex}.removeEventListener('click', btn${buttonIndex}._plkHandler);`
      );
      // Create new handler and store reference
      lines.push(`  const handler${buttonIndex} = ${handler};`);
      lines.push(`  btn${buttonIndex}._plkHandler = handler${buttonIndex};`);
      lines.push(`  btn${buttonIndex}.addEventListener('click', handler${buttonIndex});`);
      lines.push(`}`);
      buttonIndex++;
    }

    searchPos = endIdx;
  }

  return lines;
}

/**
 * Generate bindings for a single loop item as separate lines
 */
function generateLoopItemBindingLines(
  loop: { itemVar: string; template: string },
  template: string
): string[] {
  const lines: string[] = [];

  // Extract text interpolations
  lines.push(...extractLoopTextBindings(template, loop.itemVar));

  // Extract event handlers
  lines.push(...extractLoopEventBindings(template, loop.itemVar));

  return lines;
}

/**
 * Generate scripts section
 */
function generateScriptsSection(scripts: ScriptContent[]): string {
  if (!scripts || scripts.length === 0) return '';

  let code = '';
  for (const script of scripts) {
    let scriptContent = script.content;
    // Replace bare module specifiers with relative paths
    scriptContent = scriptContent.replace(/@plank\/runtime-core/g, './runtime/signals.js');
    scriptContent = scriptContent.replace(/@plank\/runtime-dom/g, './runtime/index.js');
    code += `${scriptContent}\n`;
  }
  return code;
}

/**
 * Generate mount function with directive compilation
 */
function generateMountFunction(content: string, scripts: ScriptContent[]): string {
  if (hasManualMountFunction(scripts)) {
    return '';
  }

  const htmlContent = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  const forLoops = extractForLoops(htmlContent);
  const htmlWithoutForLoops = stripForLoopsFromHtml(htmlContent);
  const directives = parseDirectives(htmlWithoutForLoops);
  const textBindings = parseTextBindings(htmlContent);

  if (directives.length === 0 && textBindings.length === 0 && forLoops.length === 0) {
    return generateEmptyMountFunction();
  }

  const lines: string[] = [];
  addRequiredImports(lines, content, directives, textBindings, forLoops);
  addMountFunctionHeader(lines);
  addSignalDeclarations(lines, directives, textBindings, content);
  addDirectiveBindings(lines, directives);
  addTextBindings(lines, textBindings);
  addForLoopBindings(lines, forLoops);
  addMountFunctionFooter(lines);

  return lines.join('\n');
}

function hasManualMountFunction(scripts: ScriptContent[]): boolean {
  return scripts.some((script) => {
    return (
      script.content.includes('export function mount') ||
      script.content.includes('export const mount')
    );
  });
}

function stripForLoopsFromHtml(htmlContent: string): string {
  const forRegex = /<(\w+)([^>]*x:for=[^>]*)>([\s\S]*?)<\/\1>/gi;
  return htmlContent.replace(forRegex, '');
}

function generateEmptyMountFunction(): string {
  return `export function mount(element, props = {}) {
  return {
    unmount: () => {
      console.log('Island unmounted');
    }
  };
}`;
}

function addRequiredImports(
  lines: string[],
  content: string,
  directives: Directive[],
  textBindings: TextBinding[],
  forLoops: ForLoop[]
): void {
  const needsRuntime = directives.length > 0 || textBindings.length > 0 || forLoops.length > 0;
  if (!needsRuntime) return;

  const hasSignalImport =
    content.includes('import { signal }') || content.includes('import {signal}');
  const hasRuntimeImport =
    content.includes('import { bindText') || content.includes('import {bindText');

  if (!hasSignalImport) {
    lines.push("import { signal } from './runtime/signals.js';");
  }
  if (!hasRuntimeImport) {
    const neededImports = getNeededRuntimeImports(directives, textBindings, forLoops);
    if (neededImports.length > 0) {
      lines.push(`import { ${neededImports.join(', ')} } from './runtime/index.js';`);
    }
  }
  if (!hasSignalImport || !hasRuntimeImport) {
    lines.push('');
  }
}

function addMountFunctionHeader(lines: string[]): void {
  lines.push('export function mount(element, props = {}) {');
  lines.push('  const effects = [];');
  lines.push('');
}

function addSignalDeclarations(
  lines: string[],
  directives: Directive[],
  textBindings: TextBinding[],
  content: string
): void {
  const signals = collectSignals(directives, textBindings);
  addSignalDeclarationsToLines(lines, signals, content);
}

function collectSignals(directives: Directive[], textBindings: TextBinding[]): Set<string> {
  const signals = new Set<string>();

  for (const dir of directives) {
    if (dir.type === 'bind' && dir.expression) {
      const signalName = extractSignalName(dir.expression);
      if (signalName) signals.add(signalName);
    }
  }

  for (const binding of textBindings) {
    if (binding.expression) {
      const signalName = extractSignalName(binding.expression);
      if (signalName) signals.add(signalName);
    }
  }

  return signals;
}

function addSignalDeclarationsToLines(
  lines: string[],
  signals: Set<string>,
  content: string
): void {
  for (const signalName of signals) {
    if (!isSignalAlreadyDeclared(signalName, content)) {
      lines.push(`  const ${signalName} = signal(${getDefaultValue(signalName)});`);
    }
  }

  if (signals.size > 0) {
    lines.push('');
  }
}

function isSignalAlreadyDeclared(signalName: string, content: string): boolean {
  const signalPattern = new RegExp(`(export\\s+)?(const|let|var)\\s+${signalName}\\s*=`, 'g');
  return signalPattern.test(content);
}

function addDirectiveBindings(lines: string[], directives: Directive[]): void {
  for (const directive of directives) {
    const selector = generateSelector(directive);
    const bindingCode = generateDirectiveBinding(directive, selector);
    if (bindingCode) {
      lines.push(`  // ${directive.type} directive`);
      lines.push(`  effects.push(${bindingCode});`);
    }
  }
}

function addTextBindings(lines: string[], textBindings: TextBinding[]): void {
  if (textBindings.length === 0) return;

  lines.push('  // Text interpolation bindings');
  for (const binding of textBindings) {
    lines.push(`  {`);
    lines.push(`    const el = element.querySelector('${binding.selector}');`);
    lines.push(`    if (el) {`);
    lines.push(`      effects.push(bindText(el, computed(() => String(${binding.expression}))));`);
    lines.push(`    }`);
    lines.push(`  }`);
  }
}

function addForLoopBindings(lines: string[], forLoops: ForLoop[]): void {
  if (forLoops.length === 0) return;

  const loopBindings = generateForLoopBindings(forLoops);
  if (loopBindings) {
    lines.push(loopBindings);
  }
}

function addMountFunctionFooter(lines: string[]): void {
  lines.push('');
  lines.push('  return {');
  lines.push('    unmount: () => {');
  lines.push('      effects.forEach(e => e?.stop?.());');
  lines.push('    }');
  lines.push('  };');
  lines.push('}');
}

/**
 * Extract directive value with proper brace matching
 */
function extractDirectiveValue(attrs: string, directiveName: string): string | null {
  const pattern = new RegExp(`${directiveName}=\\{`);
  const match = pattern.exec(attrs);
  if (!match) return null;

  const startIdx = match.index + match[0].length;
  let braceCount = 1;
  let endIdx = startIdx;

  while (endIdx < attrs.length && braceCount > 0) {
    if (attrs[endIdx] === '{') braceCount++;
    if (attrs[endIdx] === '}') braceCount--;
    endIdx++;
  }

  if (braceCount === 0) {
    return attrs.substring(startIdx, endIdx - 1);
  }

  return null;
}

/**
 * Parse directive matches from element attributes
 */
function parseDirectiveMatches(attrs: string): DirectiveMatches {
  const onMatch = attrs.match(/on:(\w+)=\{/);
  const bindMatch = attrs.match(/bind:(\w+)=\{/);
  const classMatch = attrs.match(/class:(\w+)=\{/);

  return {
    on: onMatch?.[1]
      ? [onMatch[0], onMatch[1], extractDirectiveValue(attrs, `on:${onMatch[1]}`)]
      : null,
    bind: bindMatch?.[1]
      ? [bindMatch[0], bindMatch[1], extractDirectiveValue(attrs, `bind:${bindMatch[1]}`)]
      : null,
    class: classMatch?.[1]
      ? [classMatch[0], classMatch[1], extractDirectiveValue(attrs, `class:${classMatch[1]}`)]
      : null,
    xIf: attrs.includes('x:if=') ? [null, extractDirectiveValue(attrs, 'x:if') || ''] : null,
    xFor: attrs.includes('x:for=') ? [null, extractDirectiveValue(attrs, 'x:for') || ''] : null,
  };
}

/**
 * Find tag end with proper brace matching
 */
function findTagEnd(html: string, tagStart: number, tagNameLength: number): number {
  let tagEnd = tagStart + tagNameLength;
  let braceDepth = 0;

  while (tagEnd < html.length) {
    const char = html[tagEnd];
    if (char === '{') braceDepth++;
    if (char === '}') braceDepth--;
    if (char === '>' && braceDepth === 0) break;
    tagEnd++;
  }

  return tagEnd;
}

/**
 * Parse a single element and extract directives
 */
function parseElementDirectives(
  html: string,
  tagStart: number,
  directives: Directive[],
  tagIndexMap: Map<string, number>
): number {
  if (html[tagStart + 1] === '/' || html[tagStart + 1] === '!') {
    return tagStart + 1;
  }

  const tagNameMatch = html.substring(tagStart).match(/^<(\w+)/);
  if (!tagNameMatch?.[1]) {
    return tagStart + 1;
  }

  const tag = tagNameMatch[1];
  const tagEnd = findTagEnd(html, tagStart, tagNameMatch[0].length);
  const attrs = html.substring(tagStart + tag.length + 1, tagEnd).trim();

  const currentIndex = tagIndexMap.get(tag) ?? 0;
  tagIndexMap.set(tag, currentIndex + 1);

  if (attrs) {
    const matches = parseDirectiveMatches(attrs);
    addDirectivesFromMatches(directives, matches, tag, attrs, currentIndex);
  }

  return tagEnd + 1;
}

function addDirectivesFromMatches(
  directives: Directive[],
  matches: DirectiveMatches,
  tag: string,
  attrs: string,
  currentIndex: number
): void {
  const hasDirectives = matches.on || matches.bind || matches.class || matches.xIf || matches.xFor;
  if (!hasDirectives) return;

  const selector = generateElementSelector(tag, attrs);

  if (matches.on?.[1] && matches.on[2]) {
    directives.push({
      type: 'event',
      attribute: `on:${matches.on[1]}`,
      expression: matches.on[2].trim(),
      element: tag,
      selector,
      index: currentIndex,
    });
  }

  if (matches.bind?.[1] && matches.bind[2]) {
    directives.push({
      type: 'bind',
      attribute: `bind:${matches.bind[1]}`,
      expression: matches.bind[2].trim(),
      element: tag,
      selector,
      isCheckbox: attrs.includes('type="checkbox"'),
      index: currentIndex,
    });
  }

  if (matches.class?.[1] && matches.class[2]) {
    directives.push({
      type: 'class',
      attribute: `class:${matches.class[1]}`,
      expression: matches.class[2].trim(),
      element: tag,
      selector,
      index: currentIndex,
    });
  }

  if (matches.xIf?.[1]) {
    directives.push({
      type: 'x:if',
      attribute: 'x:if',
      expression: matches.xIf[1].trim(),
      element: tag,
      selector,
      index: currentIndex,
    });
  }

  if (matches.xFor?.[1]) {
    directives.push({
      type: 'x:for',
      attribute: 'x:for',
      expression: matches.xFor[1].trim(),
      element: tag,
      selector,
      index: currentIndex,
    });
  }
}

/**
 * Parse directives from HTML content using the same logic as dev server
 */
function parseDirectives(html: string): Directive[] {
  const directives: Directive[] = [];

  const tagIndexMap = new Map<string, number>();
  let pos = 0;

  while (pos < html.length) {
    const tagStart = html.indexOf('<', pos);
    if (tagStart === -1) break;

    pos = parseElementDirectives(html, tagStart, directives, tagIndexMap);
  }

  return directives;
}

/**
 * Extract text interpolations from HTML using the same logic as dev server
 */
function parseTextBindings(html: string): TextBinding[] {
  const interpolations: TextBinding[] = [];

  // Remove x:for elements to avoid extracting loop variable interpolations like {todo.text}
  let htmlWithoutLoops = html;
  const forRegex = /<(\w+)([^>]*x:for=[^>]*)>([\s\S]*?)<\/\1>/gi;
  htmlWithoutLoops = htmlWithoutLoops.replace(forRegex, '');

  // Match text content with interpolations like {clickCount()} or {username() || 'Stranger'}
  const textRegex = /<span[^>]*>([^<]*\{[^}]+\}[^<]*)<\/span>/g;
  let match: RegExpExecArray | null = textRegex.exec(htmlWithoutLoops);
  let spanIndex = 0;

  while (match !== null) {
    const textContent = match[1];
    const interpolationMatch = textContent?.match(/\{([^}]+)\}/);

    if (interpolationMatch?.[1]) {
      const expression = interpolationMatch[1];

      // Try to find a class for better selection
      const fullMatch = match[0];
      const classMatch = fullMatch?.match(/class="([^"]+)"/);
      const className = classMatch?.[1]?.split(' ')[0];

      const selector = className ? `.${className}` : `span:nth-of-type(${spanIndex + 1})`;

      interpolations.push({
        selector,
        expression,
      });
    }

    spanIndex++;
    match = textRegex.exec(htmlWithoutLoops);
  }

  return interpolations;
}

/**
 * Generate element selector
 */
function generateElementSelector(element: string, attrs: string): string {
  // Try to find a class first
  const classMatch = attrs.match(/class="([^"]+)"/);
  if (classMatch?.[1]) {
    return `.${classMatch[1].split(' ')[0]}`;
  }

  // Try to find an id
  const idMatch = attrs.match(/id="([^"]+)"/);
  if (idMatch?.[1]) {
    return `#${idMatch[1]}`;
  }

  // Fall back to element type
  return element;
}

/**
 * Generate selector for directive
 */
function generateSelector(directive: { selector: string; index: number }): string {
  return `element.querySelectorAll('${directive.selector}')[${directive.index}]`;
}

/**
 * Generate directive binding code
 */
function generateDirectiveBinding(directive: Directive, selector: string): string {
  switch (directive.type) {
    case 'event': {
      return `bindEvent(${selector}, '${directive.attribute.split(':')[1]}', ${directive.expression})`;
    }
    case 'bind': {
      const bindType = directive.attribute.split(':')[1];
      if (directive.isCheckbox) {
        return `bindCheckbox(${selector}, ${directive.expression})`;
      } else if (bindType === 'value') {
        return `bindInputValue(${selector}, ${directive.expression})`;
      } else if (bindType === 'checked') {
        return `bindCheckbox(${selector}, ${directive.expression})`;
      }
      break;
    }
    case 'class': {
      const className = directive.attribute.split(':')[1];
      return `bindClass(${selector}, '${className}', computed(() => Boolean(${directive.expression})))`;
    }
    case 'x:if': {
      return `effect(() => {
        const shouldShow = ${directive.expression};
        ${selector}.style.display = shouldShow ? '' : 'none';
      })`;
    }
    case 'x:for': {
      // x:for is complex and needs special handling - for now, return empty
      // TODO: Implement proper x:for loop rendering
      return '';
    }
  }
  return '';
}

/**
 * Get the runtime imports that are actually needed
 */
function getNeededRuntimeImports(
  directives: Directive[],
  textBindings: TextBinding[],
  forLoops: ForLoop[] = []
): string[] {
  const imports = new Set<string>();

  addDirectiveImports(imports, directives);
  addTextBindingImports(imports, textBindings);
  addForLoopImports(imports, forLoops);

  return Array.from(imports);
}

function addDirectiveImports(imports: Set<string>, directives: Directive[]): void {
  for (const directive of directives) {
    if (directive.type === 'event') {
      imports.add('bindEvent');
    } else if (directive.type === 'bind') {
      addBindDirectiveImports(imports, directive);
    } else if (directive.type === 'class') {
      imports.add('bindClass');
      imports.add('computed');
    } else if (directive.type === 'x:if' || directive.type === 'x:for') {
      imports.add('effect');
    }
  }
}

function addBindDirectiveImports(imports: Set<string>, directive: Directive): void {
  if (directive.isCheckbox) {
    imports.add('bindCheckbox');
  } else {
    const bindType = directive.attribute.split(':')[1];
    if (bindType === 'value') {
      imports.add('bindInputValue');
    } else if (bindType === 'checked') {
      imports.add('bindCheckbox');
    }
  }
}

function addTextBindingImports(imports: Set<string>, textBindings: TextBinding[]): void {
  if (textBindings.length > 0) {
    imports.add('bindText');
    imports.add('computed');
  }
}

function addForLoopImports(imports: Set<string>, forLoops: ForLoop[]): void {
  if (forLoops.length > 0) {
    imports.add('effect');
  }
}

/**
 * Extract signal name from expression (handles function calls like clickCount())
 */
function extractSignalName(expression: string): string | null {
  // Remove function call parentheses and arguments
  const cleaned = expression.replace(/\([^)]*\)/g, '').trim();

  // Check if it's a simple identifier (no dots, brackets, etc.)
  if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(cleaned)) {
    return cleaned;
  }

  return null;
}

/**
 * Get default value for signal
 */
function getDefaultValue(signalName: string): string {
  // Simple heuristics for default values
  if (signalName.includes('count') || signalName.includes('Count')) return '0';
  if (signalName.includes('visible') || signalName.includes('Visible')) return 'false';
  if (signalName.includes('active') || signalName.includes('Active')) return 'false';
  if (signalName.includes('text') || signalName.includes('Text')) return "''";
  return 'null';
}
