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
        const modules = ctx.modules;

        // Invalidate processed files cache
        processedFiles.delete(ctx.file);
        fileHashes.delete(ctx.file);

        // Send HMR update
        ctx.server.ws.send({
          type: 'update',
          updates: [
            {
              type: 'js-update',
              path: ctx.file,
              timestamp: Date.now(),
              acceptedPath: ctx.file,
            },
          ],
        });

        return modules;
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
 * Generate island component module
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

  return `${dependenciesCode}${scriptsCode}// Island template
const template = ${JSON.stringify(htmlContent)};

// Default export
export default {
  mount,
  template,
};
`;
}

/**
 * Extract HTML content from a .plk file by removing script tags
 */
function extractHTMLFromPlk(content: string): string {
  // Remove script tags and their content
  const withoutScripts = content.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');

  // Clean up any remaining script-related content and return the HTML
  return withoutScripts.trim();
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
