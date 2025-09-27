/**
 * @fileoverview Plank template compiler
 * Parses .plk templates and generates optimized JavaScript
 */

import { parse } from './parser.js';
import { generateCode } from './codegen.js';

export interface CompilerOptions {
  /** Enable development mode with additional debugging info */
  dev?: boolean;
  /** Target runtime environment */
  target?: 'node' | 'bun' | 'edge' | 'deno' | 'client' | 'server';
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
export function compile(source: string, options: CompilerOptions = {}): CompileResult {
  // Parse the template first
  const parseResult = parse(source, {
    dev: options.dev,
    filename: options.filename,
  });

  // Generate code from AST
  const target = options.target || 'client';
  const codegenOptions: Parameters<typeof generateCode>[1] = {
    target: target as 'server' | 'client',
    dev: options.dev ?? false,
    filename: options.filename,
    sourceMap: options.sourceMap,
  };
  const codegenResult = generateCode(parseResult, codegenOptions);

  return {
    code: codegenResult.code,
    scripts: parseResult.scripts,
    dependencies: codegenResult.dependencies,
    islands: codegenResult.islands,
    actions: codegenResult.actions,
    errors: parseResult.errors,
  };
}

// Re-export grammar definitions
export {
  DIRECTIVE_PATTERNS,
  EXPRESSION_OPERATORS,
  getDirectiveType,
  ISLAND_STRATEGIES,
  isValidDirective,
  isValidExpression,
  isValidIslandStrategy,
  RESERVED_KEYWORDS,
} from './grammar.js';
export type {
  DirectiveNode,
  ExpressionNode,
  ForLoopNode,
  IslandNode,
  ParseError,
  ParseResult,
  ScriptNode,
  TemplateNode,
} from './parser.js';
// Re-export parser functionality
export { parse, validate } from './parser.js';
// Re-export code generation functionality
export { generateCode, generateDOMIR } from './codegen.js';
