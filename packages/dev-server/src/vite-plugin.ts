/**
 * @fileoverview Vite plugin for Plank .plk file processing
 */

// Note: These imports will be available at runtime
// import type { Plugin } from 'vite';
// import { compile } from '@plank/compiler';

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { PlankPluginOptions } from './types.js';

// Temporary type definitions until dependencies are installed
// biome-ignore lint/suspicious/noExplicitAny: Temporary types until dependencies are installed
type Plugin = any;

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

        // Store processed content and hash
        processedFiles.set(id, result.code);
        fileHashes.set(id, hash);

        return {
          code: result.code,
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
        this.error(`Failed to process .plk file: ${id}`, {
          id,
          plugin: 'plank',
          error: error as Error,
        });
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
    const code = generateJavaScriptCode(result, filePath, options);

    return {
      code,
      map: result.map,
      scripts: result.scripts,
      dependencies: result.dependencies,
      islands: result.islands,
      actions: result.actions,
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
      errors: [error],
    };
  }
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
    errors: unknown[];
  },
  filePath: string,
  _options: {
    sourcemap: boolean;
    transform: PlankPluginOptions['transform'];
  }
): string {
  const { code, scripts, dependencies, islands, actions, errors } = result;

  // If there are compilation errors, return error code
  if (errors.length > 0) {
    return generateErrorCode(
      new Error(`Compilation errors: ${errors.map((e) => String(e)).join(', ')}`),
      filePath
    );
  }

  // Generate module code
  let moduleCode = '';

  // Add imports for dependencies
  if (dependencies.length > 0) {
    moduleCode += `// Dependencies\n`;
    for (const dep of dependencies) {
      moduleCode += `import ${JSON.stringify(dep)};\n`;
    }
    moduleCode += '\n';
  }

  // Add script content
  if (scripts.length > 0) {
    moduleCode += `// Scripts\n`;
    for (const script of scripts) {
      moduleCode += `${script}\n\n`;
    }
  }

  // Add template code
  moduleCode += `// Template\n`;
  moduleCode += `export const template = ${JSON.stringify(code)};\n\n`;

  // Add islands
  if (islands.length > 0) {
    moduleCode += `// Islands\n`;
    moduleCode += `export const islands = ${JSON.stringify(islands)};\n\n`;
  }

  // Add actions
  if (actions.length > 0) {
    moduleCode += `// Actions\n`;
    moduleCode += `export const actions = ${JSON.stringify(actions)};\n\n`;
  }

  // Add default export
  moduleCode += `// Default export\n`;
  moduleCode += `export default {\n`;
  moduleCode += `  template,\n`;
  if (islands.length > 0) {
    moduleCode += `  islands,\n`;
  }
  if (actions.length > 0) {
    moduleCode += `  actions,\n`;
  }
  moduleCode += `};\n`;

  return moduleCode;
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
