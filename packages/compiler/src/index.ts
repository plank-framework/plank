/**
 * @fileoverview Plank template compiler
 * Parses .plk templates and generates optimized JavaScript
 */

import { parse } from './parser.js';

export interface CompilerOptions {
  /** Enable development mode with additional debugging info */
  dev?: boolean;
  /** Target runtime environment */
  target?: 'node' | 'bun' | 'edge' | 'deno';
  /** Enable source maps */
  sourceMap?: boolean;
  /** Source file path for error reporting */
  filename?: string;
}

export interface CompileResult {
  /** Generated JavaScript code */
  code: string;
  /** Source map if enabled */
  map?: string;
  /** Scripts found in the template */
  scripts: Array<{ type: 'server' | 'client'; content: string; exports?: string[] }>;
  /** List of dependencies found in the template */
  dependencies: string[];
  /** Islands detected in the template */
  islands: string[];
  /** Server actions found */
  actions: string[];
  /** Parsing errors */
  errors: Array<{ message: string; line: number; column: number; filename?: string | undefined }>;
}

/**
 * Compile a Plank template (.plk) to JavaScript
 */
export function compile(
  source: string,
  options: CompilerOptions = {}
): CompileResult {
  // Parse the template first
  const parseResult = parse(source, {
    dev: options.dev,
    filename: options.filename
  });

  // TODO: Implement code generation from AST
  // This is a placeholder for Phase A implementation

  return {
    code: '// TODO: Implement template compilation from AST',
    scripts: parseResult.scripts,
    dependencies: parseResult.dependencies,
    islands: parseResult.islands,
    actions: parseResult.actions,
    errors: parseResult.errors
  };
}

// Re-export parser functionality
export { parse, validate } from './parser.js';
export type {
  TemplateNode,
  DirectiveNode,
  IslandNode,
  ScriptNode,
  ExpressionNode,
  ForLoopNode,
  ParseResult,
  ParseError
} from './parser.js';

// Re-export grammar definitions
export {
  DIRECTIVE_PATTERNS,
  ISLAND_STRATEGIES,
  EXPRESSION_OPERATORS,
  RESERVED_KEYWORDS,
  isValidDirective,
  getDirectiveType,
  isValidIslandStrategy,
  isValidExpression
} from './grammar.js';
