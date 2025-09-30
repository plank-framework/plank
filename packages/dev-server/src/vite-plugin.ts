/**
 * @fileoverview Vite plugin for Plank .plk file processing
 */

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import type { PlankPluginOptions } from './types.js';

/**
 * Create Vite plugin for Plank
 */
export function plankPlugin(options: PlankPluginOptions = {}): Plugin {
  const {
    routesDir = './app/routes',
    hmr = true,
    extensions = ['.plk'],
    sourcemap = true,
    transform = {},
  } = options;

  const processedFiles = new Map<string, string>();
  const fileHashes = new Map<string, string>();

  return {
    name: 'plank',
    version: '1.0.0',

    async resolveId(id: string, importer?: string) {
      // Handle .plk file imports
      if (extensions.some((ext) => id.endsWith(ext))) {
        const resolved = await this.resolve(id, importer, { skipSelf: true });
        if (resolved) {
          return resolved.id;
        }

        // Try to resolve relative to routes directory
        const routesPath = resolve(routesDir, id);
        try {
          await stat(routesPath);
          return routesPath;
        } catch {
          // File doesn't exist
          return null;
        }
      }

      return null;
    },

    async load(id: string) {
      // Only process .plk files
      if (!extensions.some((ext) => id.endsWith(ext))) {
        return null;
      }

      try {
        const content = await readFile(id, 'utf-8');
        const hash = createHash('md5').update(content).digest('hex');

        // Check if file has changed
        const previousHash = fileHashes.get(id);
        if (previousHash === hash) {
          return processedFiles.get(id) || null;
        }

        // Process the .plk file
        const result = await processPlkFile(id, content, {
          sourcemap,
          transform,
        });

        // Check if this is an island component (contains /islands/ in path)
        const isIsland = id.includes('/islands/') || id.includes('\\islands\\');

        let finalCode: string;
        if (isIsland) {
          // Generate island component module with original content for HTML extraction
          finalCode = generateIslandModule(result, content, {
            sourcemap,
            transform,
          });
        } else {
          // Use regular HTML code for non-island files
          finalCode = result.code;
        }

        // Store processed content and hash
        processedFiles.set(id, finalCode);
        fileHashes.set(id, hash);

        return {
          code: finalCode,
          map: result.map,
          meta: {
            plank: {
              scripts: result.scripts,
              dependencies: result.dependencies,
              islands: result.islands,
              actions: result.actions,
              errors: result.errors,
            },
          },
        };
      } catch (error) {
        const err = error as Error;
        this.error(`Failed to process .plk file: ${id}\n${err.message}\n${err.stack || ''}`);
        return null;
      }
    },

    // biome-ignore lint/suspicious/noExplicitAny: Vite HMR context type compatibility
    handleHotUpdate(ctx: any) {
      // Handle HMR for .plk files
      if (hmr && extensions.some((ext) => ctx.file.endsWith(ext))) {
        // Invalidate processed files cache
        processedFiles.delete(ctx.file);
        fileHashes.delete(ctx.file);

        // .plk files are server-rendered templates - trigger full page reload
        ctx.server.ws.send({
          type: 'full-reload',
          path: '*',
        });

        // Return empty array to prevent default HMR
        return [];
      }

      return undefined;
    },

    buildStart() {
      // Clear caches on build start
      processedFiles.clear();
      fileHashes.clear();
    },
  };
}

/**
 * Process a .plk file
 */
async function processPlkFile(
  filePath: string,
  content: string,
  options: {
    sourcemap: boolean;
    transform: PlankPluginOptions['transform'];
  }
): Promise<{
  code: string;
  map: string | undefined;
  scripts: unknown[];
  dependencies: unknown[];
  islands: unknown[];
  actions: unknown[];
  chunks: unknown[];
  errors: unknown[];
}> {
  try {
    // Compile the .plk file
    // Note: This will be available at runtime when @plank/compiler is installed
    const { compile } = await import('@plank/compiler');
    const result = compile(content, {
      filename: filePath,
      sourceMap: options.sourcemap,
    });

    // Generate JavaScript code
    const code = generateJavaScriptCode(result, filePath, content, options);

    return {
      code,
      map: result.map,
      scripts: result.scripts,
      dependencies: result.dependencies,
      islands: result.islands,
      actions: result.actions,
      chunks: result.chunks,
      errors: result.errors,
    };
  } catch (error) {
    // Return error as code for development
    const errorCode = generateErrorCode(error as Error, filePath);
    return {
      code: errorCode,
      map: undefined,
      scripts: [],
      dependencies: [],
      islands: [],
      actions: [],
      chunks: [],
      errors: [error],
    };
  }
}

/**
 * Generate regular module exports section
 */
function generateModuleExports(
  code: string,
  islands: unknown[],
  actions: unknown[],
  chunks: unknown[]
): string {
  let moduleCode = `// Template\nexport const template = ${JSON.stringify(code)};\n\n`;

  if (islands.length > 0) {
    moduleCode += `// Islands\nexport const islands = ${JSON.stringify(islands)};\n\n`;
  }

  if (actions.length > 0) {
    moduleCode += `// Actions\nexport const actions = ${JSON.stringify(actions)};\n\n`;
  }

  if (chunks.length > 0) {
    moduleCode += `// Chunks\nexport const chunks = ${JSON.stringify(chunks)};\n\n`;
  }

  // Add default export
  moduleCode += `// Default export\nexport default {\n  template,\n`;
  if (islands.length > 0) moduleCode += `  islands,\n`;
  if (actions.length > 0) moduleCode += `  actions,\n`;
  if (chunks.length > 0) moduleCode += `  chunks,\n`;
  moduleCode += `};\n`;

  return moduleCode;
}

/**
 * Generate regular module code with scripts and dependencies
 */
function generateRegularModule(
  result: {
    code: string;
    scripts: unknown[];
    dependencies: unknown[];
    islands: unknown[];
    actions: unknown[];
    chunks: unknown[];
  },
  filePath: string,
  options: { sourcemap: boolean }
): string {
  const { code, scripts, dependencies, islands, actions, chunks } = result;
  let moduleCode = '';

  if (options.sourcemap) {
    moduleCode += `//# sourceMappingURL=${filePath}.map\n\n`;
  }

  if (dependencies.length > 0) {
    moduleCode += `// Dependencies\n`;
    for (const dep of dependencies) {
      moduleCode += `import ${JSON.stringify(dep)};\n`;
    }
    moduleCode += '\n';
  }

  if (scripts.length > 0) {
    moduleCode += `// Scripts\n`;
    for (const script of scripts) {
      moduleCode += `${script}\n\n`;
    }
  }

  moduleCode += generateModuleExports(code, islands, actions, chunks);

  return moduleCode;
}

/**
 * Generate JavaScript code from compilation result
 */
function generateJavaScriptCode(
  result: {
    code: string;
    scripts: unknown[];
    dependencies: unknown[];
    islands: unknown[];
    actions: unknown[];
    chunks: unknown[];
    errors: unknown[];
  },
  filePath: string,
  originalContent: string,
  options: {
    sourcemap: boolean;
    transform: PlankPluginOptions['transform'];
  }
): string {
  // If there are compilation errors, return error code
  if (result.errors.length > 0) {
    return generateErrorCode(
      new Error(`Compilation errors: ${result.errors.map((e) => String(e)).join(', ')}`),
      filePath
    );
  }

  // Check if this is an island component (contains /islands/ in path)
  const isIsland = filePath.includes('/islands/') || filePath.includes('\\islands\\');

  if (isIsland) {
    return generateIslandModule(result, originalContent, options);
  }

  return generateRegularModule(result, filePath, options);
}

/**
 * Generate dependencies section for island module
 */
function generateDependenciesSection(
  dependencies: unknown[],
  options: { sourcemap: boolean }
): string {
  let code = '';

  // Add sourcemap reference if enabled
  if (options.sourcemap) {
    code += '//# sourceMappingURL=island.map\n\n';
  }

  if (dependencies.length === 0) return code;

  code += '// Dependencies\n';
  for (const dep of dependencies) {
    code += `import ${JSON.stringify(dep)};\n`;
  }
  return `${code}\n`;
}

/**
 * Generate scripts section for island module
 */
function generateScriptsSection(scripts: unknown[]): string {
  if (scripts.length === 0) return '';

  let code = '// Island component logic\n';
  for (const script of scripts) {
    const scriptContent = extractScriptContent(script);
    if (scriptContent) {
      code += `${scriptContent}\n\n`;
    }
  }
  return code;
}

/**
 * Extract content from a script object or string
 */
function extractScriptContent(script: unknown): string | null {
  if (typeof script === 'string') return script;
  if (typeof script === 'object' && script !== null) {
    const scriptObj = script as { content?: string };
    return scriptObj.content || null;
  }
  return null;
}

/**
 * Generate island component module with auto-compiled directives
 */
function generateIslandModule(
  result: {
    code: string;
    scripts: unknown[];
    dependencies: unknown[];
    islands: unknown[];
    actions: unknown[];
    chunks: unknown[];
    errors: unknown[];
  },
  originalContent: string,
  options: {
    sourcemap: boolean;
    transform: PlankPluginOptions['transform'];
  }
): string {
  const { scripts, dependencies } = result;
  const htmlContent = extractHTMLFromPlk(originalContent);

  const dependenciesCode = generateDependenciesSection(dependencies, options);
  const scriptsCode = generateScriptsSection(scripts);
  const mountCode = generateMountFunction(originalContent, scripts);

  const finalCode = `${dependenciesCode}${scriptsCode}// Island template
const template = ${JSON.stringify(htmlContent)};

${mountCode}

// Default export
export default {
  mount,
  template,
};
`;

  // Debug: Log generated code in development
  if (process.env.DEBUG_PLANK) {
    console.log('=== Generated Island Module ===');
    console.log(finalCode);
    console.log('=== End Generated Module ===');
  }

  return finalCode;
}

/**
 * Determine required imports for directives
 */
function getRequiredImports(
  directives: Array<{ type: string; isCheckbox?: boolean }>,
  textBindings: Array<unknown>
): { runtimeDom: Set<string>; runtimeCore: Set<string> } {
  const runtimeDomImports = new Set<string>();
  const runtimeCoreImports = new Set<string>();

  for (const directive of directives) {
    if (directive.type === 'on') runtimeDomImports.add('bindEvent');
    if (directive.type === 'bind') {
      if (directive.isCheckbox) {
        runtimeDomImports.add('bindCheckbox');
      } else {
        runtimeDomImports.add('bindInputValue');
      }
    }
    if (directive.type === 'class') {
      runtimeDomImports.add('bindClass');
      runtimeCoreImports.add('computed');
    }
    if (directive.type === 'x:if') runtimeCoreImports.add('effect');
  }

  if (textBindings.length > 0) {
    runtimeDomImports.add('bindText');
    runtimeCoreImports.add('computed');
  }

  return { runtimeDom: runtimeDomImports, runtimeCore: runtimeCoreImports };
}

/**
 * Generate import statements for mount function
 */
function generateImportStatements(
  runtimeCoreImports: Set<string>,
  runtimeDomImports: Set<string>
): string[] {
  const lines: string[] = [];

  if (runtimeCoreImports.size > 0) {
    lines.push(
      `import { ${Array.from(runtimeCoreImports).join(', ')} } from '@plank/runtime-core';`
    );
  }

  if (runtimeDomImports.size > 0) {
    lines.push(`import { ${Array.from(runtimeDomImports).join(', ')} } from '@plank/runtime-dom';`);
  }

  if (runtimeCoreImports.size > 0 || runtimeDomImports.size > 0) {
    lines.push('');
  }

  return lines;
}

/**
 * Generate mount function from template directives using runtime bindings
 */
function generateMountFunction(content: string, scripts: unknown[]): string {
  // Check if the island already has a mount function defined
  const hasManualMount = scripts.some((script) => {
    const scriptContent = extractScriptContent(script);
    return (
      scriptContent?.includes('export function mount') ||
      scriptContent?.includes('export const mount')
    );
  });

  // If a manual mount function exists, don't generate one
  if (hasManualMount) {
    return '';
  }

  // IMPORTANT: Extract directives BEFORE stripping them from HTML!
  const htmlWithDirectives = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  const forLoops = extractForLoops(htmlWithDirectives);

  // Strip x:for elements before extracting other directives
  // to avoid binding their internal directives in the main mount function
  let htmlWithoutForLoops = htmlWithDirectives;
  const forRegex = /<(\w+)([^>]*x:for=[^>]*)>([\s\S]*?)<\/\1>/gi;
  htmlWithoutForLoops = htmlWithoutForLoops.replace(forRegex, '');

  const directives = extractDirectivesFromHTML(htmlWithoutForLoops);
  const textBindings = extractTextInterpolations(htmlWithDirectives);

  const lines: string[] = [];

  // Determine what imports we need
  const needsBindings = directives.length > 0 || textBindings.length > 0 || forLoops.length > 0;

  if (needsBindings) {
    const { runtimeDom, runtimeCore } = getRequiredImports(directives, textBindings);

    // Add effect for x:for loops
    if (forLoops.length > 0) {
      runtimeCore.add('effect');
    }

    const importLines = generateImportStatements(runtimeCore, runtimeDom);
    lines.push(...importLines);
  }

  lines.push('// Auto-generated mount function from directives');
  lines.push('export function mount(element, props = {}) {');
  lines.push('  const effects = [];');
  lines.push('');

  // Generate bindings using runtime utilities
  const bindingCode = generateRuntimeBindings(directives);
  if (bindingCode) {
    lines.push(bindingCode);
  }

  // Generate text interpolation bindings
  const textBindingCode = generateRuntimeTextBindings(textBindings);
  if (textBindingCode) {
    lines.push(textBindingCode);
  }

  // Generate x:for loop bindings
  const forLoopCode = generateForLoopBindings(forLoops);
  if (forLoopCode) {
    lines.push(forLoopCode);
  }

  lines.push('');
  lines.push('  return {');
  lines.push('    unmount: () => {');
  lines.push('      effects.forEach(e => e?.stop?.());');
  lines.push('    }');
  lines.push('  };');
  lines.push('}');

  return lines.join('\n');
}

/**
 * Generate x:for loop rendering code
 */
function generateForLoopBindings(
  loops: Array<{
    itemVar: string;
    itemsVar: string;
    keyExpr?: string;
    template: string;
    originalTemplate: string;
    containerTag: string;
    index: number;
  }>
): string {
  if (loops.length === 0) return '';

  const lines: string[] = [];
  lines.push('');
  lines.push('  // x:for list rendering');

  for (const loop of loops) {
    const { itemVar, itemsVar, keyExpr, template, originalTemplate, containerTag, index } = loop;

    lines.push(`  {`);
    lines.push(`    // Find parent container (x:for element's parent)`);
    lines.push(`    const allContainers = element.querySelectorAll('${containerTag}');`);
    lines.push(`    const loopContainer = allContainers[${index}];`);
    lines.push(`    if (loopContainer && loopContainer.parentElement) {`);
    lines.push(`      const container = loopContainer.parentElement;`);
    lines.push(`      const itemTemplate = ${JSON.stringify(template)};`);
    lines.push(`      const renderedItems = new Map(); // Track rendered items by key`);
    lines.push(`      const placeholder = loopContainer; // Original element as placeholder`);
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
      lines.push(`        for (const [key, el] of renderedItems.entries()) {`);
      lines.push(`          if (!newKeys.has(key)) {`);
      lines.push(`            el?.remove(); // Remove from DOM`);
      lines.push(`            renderedItems.delete(key); // Remove from Map`);
      lines.push(`          }`);
      lines.push(`        }`);
      lines.push(`        `);
    }

    lines.push(`        // Update DOM - replace placeholder or update container`);
    lines.push(`        if (placeholder.parentElement) {`);
    lines.push(`          // Remove all existing rendered items from DOM first`);
    lines.push(`          let next = placeholder.nextSibling;`);
    lines.push(`          while (next) {`);
    lines.push(`            const current = next;`);
    lines.push(`            next = next.nextSibling;`);
    lines.push(`            // Check if this is one of our rendered items`);
    lines.push(`            if (current.nodeType === 1 && current !== placeholder) {`);
    lines.push(`              let isOurItem = false;`);
    lines.push(`              for (const [, el] of renderedItems.entries()) {`);
    lines.push(`                if (el === current) { isOurItem = true; break; }`);
    lines.push(`              }`);
    lines.push(`              if (isOurItem) current.remove();`);
    lines.push(`            }`);
    lines.push(`          }`);
    lines.push(`          `);
    lines.push(`          // Insert items in correct order after placeholder`);
    lines.push(`          placeholder.style.display = 'none'; // Hide placeholder`);
    lines.push(`          for (let i = itemElements.length - 1; i >= 0; i--) {`);
    lines.push(`            const itemEl = itemElements[i];`);
    lines.push(`            if (itemEl && placeholder.nextSibling) {`);
    lines.push(`              container.insertBefore(itemEl, placeholder.nextSibling);`);
    lines.push(`            } else if (itemEl) {`);
    lines.push(`              container.appendChild(itemEl);`);
    lines.push(`            }`);
    lines.push(`          }`);
    lines.push(`        }`);
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
function parseDirectiveMatches(attrs: string) {
  const onMatch = attrs.match(/on:(\w+)=\{/);
  const bindMatch = attrs.match(/bind:(\w+)=\{/);
  const classMatch = attrs.match(/class:(\w+)=\{/);

  return {
    on: onMatch ? [onMatch[0], onMatch[1], extractDirectiveValue(attrs, `on:${onMatch[1]}`)] : null,
    bind: bindMatch
      ? [bindMatch[0], bindMatch[1], extractDirectiveValue(attrs, `bind:${bindMatch[1]}`)]
      : null,
    class: classMatch
      ? [classMatch[0], classMatch[1], extractDirectiveValue(attrs, `class:${classMatch[1]}`)]
      : null,
    xIf: attrs.includes('x:if=') ? [null, extractDirectiveValue(attrs, 'x:if')] : null,
    xFor: attrs.includes('x:for=') ? [null, extractDirectiveValue(attrs, 'x:for')] : null,
  };
}

/**
 * Add directive to array if match exists
 */
function addDirectiveIfMatched(
  directives: Array<{
    type: string;
    selector: string;
    attribute: string;
    value: string;
    isCheckbox?: boolean;
    index: number;
  }>,
  matches: ReturnType<typeof parseDirectiveMatches>,
  tag: string,
  attrs: string,
  index: number
): void {
  const { on, bind, class: cls, xIf, xFor } = matches;

  if (on?.[1] && on[2]) {
    directives.push({ type: 'on', selector: tag, attribute: on[1], value: on[2], index });
  }

  if (bind?.[1] && bind[2]) {
    const isCheckbox = attrs.includes('type="checkbox"');
    directives.push({
      type: 'bind',
      selector: tag,
      attribute: bind[1],
      value: bind[2],
      isCheckbox,
      index,
    });
  }

  if (cls?.[1] && cls[2]) {
    directives.push({ type: 'class', selector: tag, attribute: cls[1], value: cls[2], index });
  }

  if (xIf?.[1]) {
    directives.push({ type: 'x:if', selector: tag, attribute: 'if', value: xIf[1], index });
  }

  if (xFor?.[1]) {
    directives.push({ type: 'x:for', selector: tag, attribute: 'for', value: xFor[1], index });
  }
}

/**
 * Remove directive attributes from HTML (handles nested braces like arrow functions)
 */
function stripDirectives(html: string): string {
  let result = html;

  // Match directives one by one and remove them with proper brace matching
  const directivePattern = /(on|bind|class|attr|x):[\w-]+=\{/g;
  let match: RegExpExecArray | null = directivePattern.exec(result);

  while (match !== null) {
    const startIdx = match.index;
    const braceStart = result.indexOf('{', startIdx);

    if (braceStart !== -1) {
      // Find matching closing brace
      let braceCount = 1;
      let endIdx = braceStart + 1;

      while (endIdx < result.length && braceCount > 0) {
        if (result[endIdx] === '{') braceCount++;
        if (result[endIdx] === '}') braceCount--;
        endIdx++;
      }

      // Remove the directive attribute including leading space
      const beforeDirective = result.substring(0, startIdx).replace(/\s+$/, '');
      const afterDirective = result.substring(endIdx);
      result = beforeDirective + afterDirective;

      // Reset regex since we modified the string
      directivePattern.lastIndex = 0;
    }

    match = directivePattern.exec(result);
  }

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
        containerTag: tag,
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
 * Find the end of an opening tag, handling > inside {}
 */
function findTagEnd(html: string, tagStart: number, tagNameLength: number): number {
  let tagEnd = tagStart + tagNameLength;
  let braceDepth = 0;

  while (tagEnd < html.length) {
    const char = html[tagEnd];
    if (char === '{') braceDepth++;
    else if (char === '}') braceDepth--;
    else if (char === '>' && braceDepth === 0) break;
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
  directives: Array<{
    type: string;
    selector: string;
    attribute: string;
    value: string;
    isCheckbox?: boolean;
    index: number;
  }>,
  tagIndexMap: Map<string, number>
): number {
  // Skip closing tags and comments
  if (html[tagStart + 1] === '/' || html[tagStart + 1] === '!') {
    return tagStart + 1;
  }

  // Find tag name
  const tagNameMatch = html.substring(tagStart).match(/^<(\w+)/);
  if (!tagNameMatch?.[1]) {
    return tagStart + 1;
  }

  const tag = tagNameMatch[1];
  const tagEnd = findTagEnd(html, tagStart, tagNameMatch[0].length);
  const attrs = html.substring(tagStart + tag.length + 1, tagEnd).trim();

  // Always increment the index for this tag type (even if no directives)
  // This ensures querySelectorAll('tag')[index] matches the correct element
  const currentIndex = tagIndexMap.get(tag) ?? 0;
  tagIndexMap.set(tag, currentIndex + 1);

  if (attrs) {
    const matches = parseDirectiveMatches(attrs);
    const hasDirectives =
      matches.on || matches.bind || matches.class || matches.xIf || matches.xFor;

    if (hasDirectives) {
      addDirectiveIfMatched(directives, matches, tag, attrs, currentIndex);
    }
  }

  return tagEnd + 1;
}

/**
 * Extract directives from HTML content using index-based tracking
 */
function extractDirectivesFromHTML(html: string): Array<{
  type: string;
  selector: string;
  attribute: string;
  value: string;
  isCheckbox?: boolean;
  index: number;
}> {
  const directives: Array<{
    type: string;
    selector: string;
    attribute: string;
    value: string;
    isCheckbox?: boolean;
    index: number;
  }> = [];

  // Track index per tag type (e.g., input[0], button[0], button[1], etc.)
  const tagIndexMap = new Map<string, number>();

  // Manually parse elements to handle > inside attribute values
  let pos = 0;

  while (pos < html.length) {
    const tagStart = html.indexOf('<', pos);
    if (tagStart === -1) break;

    pos = parseElementDirectives(html, tagStart, directives, tagIndexMap);
  }

  return directives;
}

/**
 * Extract text interpolations from HTML
 * NOTE: Skips interpolations inside x:for elements
 */
function extractTextInterpolations(html: string): Array<{
  selector: string;
  expression: string;
}> {
  const interpolations: Array<{
    selector: string;
    expression: string;
  }> = [];

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
 * Generate text binding code using runtime utilities
 */
function generateRuntimeTextBindings(
  bindings: Array<{
    selector: string;
    expression: string;
  }>
): string {
  if (bindings.length === 0) return '';

  const lines: string[] = [];
  lines.push('  // Text interpolation bindings');

  for (const binding of bindings) {
    lines.push(`  {`);
    lines.push(`    const el = element.querySelector('${binding.selector}');`);
    lines.push(`    if (el) {`);
    lines.push(`      effects.push(bindText(el, computed(() => String(${binding.expression}))));`);
    lines.push(`    }`);
    lines.push(`  }`);
  }

  return lines.join('\n');
}

/**
 * Generate binding code for directives using runtime utilities
 */
function generateRuntimeBindings(
  directives: Array<{
    type: string;
    selector: string;
    attribute: string;
    value: string;
    isCheckbox?: boolean;
    index: number;
  }>
): string {
  if (directives.length === 0) return '';

  const lines: string[] = [];
  lines.push('  // Setup directive bindings');

  for (const directive of directives) {
    const { type, selector, attribute, value, isCheckbox, index } = directive;

    if (type === 'on') {
      // Event handlers using bindEvent
      lines.push(`  {`);
      lines.push(`    const el = element.querySelectorAll('${selector}')[${index}];`);
      lines.push(`    if (el) {`);
      lines.push(`      effects.push(bindEvent(el, '${attribute}', ${value}));`);
      lines.push(`    }`);
      lines.push(`  }`);
    } else if (type === 'bind') {
      // Two-way bindings using bindCheckbox or bindInputValue
      if (isCheckbox) {
        lines.push(`  {`);
        lines.push(`    const el = element.querySelectorAll('${selector}')[${index}];`);
        lines.push(`    if (el) {`);
        lines.push(`      effects.push(bindCheckbox(el, ${value}));`);
        lines.push(`    }`);
        lines.push(`  }`);
      } else {
        lines.push(`  {`);
        lines.push(`    const el = element.querySelectorAll('${selector}')[${index}];`);
        lines.push(`    if (el) {`);
        lines.push(`      effects.push(bindInputValue(el, ${value}));`);
        lines.push(`    }`);
        lines.push(`  }`);
      }
    } else if (type === 'class') {
      // Class bindings using bindClass with computed
      lines.push(`  {`);
      lines.push(`    const el = element.querySelectorAll('${selector}')[${index}];`);
      lines.push(`    if (el) {`);
      lines.push(
        `      effects.push(bindClass(el, '${attribute}', computed(() => Boolean(${value}))));`
      );
      lines.push(`    }`);
      lines.push(`  }`);
    } else if (type === 'x:if') {
      // Conditional rendering using effect and style.display
      lines.push(`  {`);
      lines.push(`    const el = element.querySelectorAll('${selector}')[${index}];`);
      lines.push(`    if (el) {`);
      lines.push(`      effects.push(effect(() => {`);
      lines.push(`        const shouldShow = ${value};`);
      lines.push(`        el.style.display = shouldShow ? '' : 'none';`);
      lines.push(`      }));`);
      lines.push(`    }`);
      lines.push(`  }`);
    }
  }

  return lines.join('\n');
}

/**
 * Extract HTML content from a .plk file by removing script tags and directives
 */
function extractHTMLFromPlk(content: string): string {
  // Remove script tags and their content
  let html = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Keep style tags - they will be injected into the DOM with the template
  // No need to remove them, the browser will apply them when innerHTML is set

  // Remove directive attributes using proper brace matching
  html = stripDirectives(html);

  // Clean up any remaining script-related content and return the HTML
  return html.trim();
}

/**
 * Generate error code for development
 */
function generateErrorCode(error: Error, filePath: string): string {
  return `
// Error in ${filePath}
console.error('Plank compilation error:', ${JSON.stringify(error.message)});
console.error('Stack:', ${JSON.stringify(error.stack)});

// Export error for HMR
export const error = ${JSON.stringify({
    message: error.message,
    stack: error.stack,
    file: filePath,
  })};

export default {
  error,
  template: '<div class="plank-error">Compilation Error: ${error.message.replace(/'/g, "\\'")}</div>',
  islands: [],
  actions: [],
};
`;
}

// Export internal functions for testing
export const __testing__ = {
  generateMountFunction,
  extractDirectivesFromHTML,
  extractForLoops,
  extractTextInterpolations,
  stripDirectives,
  extractHTMLFromPlk,
};
