/**
 * @fileoverview Plank template parser implementation
 */

import {
  TemplateNode,
  DirectiveNode,
  IslandNode,
  ScriptNode,
  ExpressionNode,
  ForLoopNode,
  DIRECTIVE_PATTERNS,
  ISLAND_STRATEGIES,
  getDirectiveType,
  isValidIslandStrategy,
  isValidExpression
} from './grammar.js';

// Re-export types for external use
export type {
  TemplateNode,
  DirectiveNode,
  IslandNode,
  ScriptNode,
  ExpressionNode,
  ForLoopNode
} from './grammar.js';

export interface ParseOptions {
  /** Enable development mode with additional debugging info */
  dev?: boolean | undefined;
  /** Source file path for error reporting */
  filename?: string | undefined;
}

export interface ParseResult {
  /** Parsed template AST */
  ast: TemplateNode;
  /** List of dependencies found in the template */
  dependencies: string[];
  /** Islands detected in the template */
  islands: string[];
  /** Server actions found */
  actions: string[];
  /** Errors encountered during parsing */
  errors: ParseError[];
}

export interface ParseError {
  message: string;
  line: number;
  column: number;
  filename?: string | undefined;
}

export class PlankParser {
  private source: string;
  private filename: string | undefined;
  private dev: boolean;
  private errors: ParseError[] = [];
  private dependencies: string[] = [];
  private islands: string[] = [];
  private actions: string[] = [];

  constructor(source: string, options: ParseOptions = {}) {
    this.source = source;
    this.filename = options.filename ?? undefined;
    this.dev = options.dev || false;
  }

  /**
   * Parse the template source into an AST
   */
  parse(): ParseResult {
    this.errors = [];
    this.dependencies = [];
    this.islands = [];
    this.actions = [];

    try {
      const ast = this.parseTemplate();
      return {
        ast,
        dependencies: this.dependencies,
        islands: this.islands,
        actions: this.actions,
        errors: this.errors
      };
    } catch (error) {
      this.addError(`Parse error: ${error instanceof Error ? error.message : String(error)}`);
      return {
        ast: { type: 'template', children: [] },
        dependencies: [],
        islands: [],
        actions: [],
        errors: this.errors
      };
    }
  }

  private parseTemplate(): TemplateNode {
    // TODO: Implement full HTML parsing
    // This is a placeholder for Phase A implementation

    const template: TemplateNode = {
      type: 'template',
      children: []
    };

    // For now, return a basic template structure
    // Full HTML parsing will be implemented in the next iteration
    return template;
  }

  private parseElement(tagName: string, attributes: Record<string, string>): TemplateNode {
    const element: TemplateNode = {
      type: 'element',
      tag: tagName,
      attributes,
      children: []
    };

    // Parse directives
    for (const [name, value] of Object.entries(attributes)) {
      const directiveType = getDirectiveType(name);
      if (directiveType) {
        element.directive = this.parseDirective(directiveType, name, value);
      }
    }

    // Check for islands
    if (tagName === 'island') {
      element.island = this.parseIsland(attributes);
    }

    return element;
  }

  private parseDirective(type: DirectiveNode['type'], name: string, value: string): DirectiveNode {
    const directive: DirectiveNode = {
      type,
      name,
      value
    };

    // Parse expression for reactive directives
    if (['on', 'bind', 'x-if', 'x-show', 'x-for', 'class', 'attr'].includes(type)) {
      if (!isValidExpression(value)) {
        this.addError(`Invalid expression: ${value}`);
      } else {
        directive.expression = this.parseExpression(value);
      }
    }

    // Track server actions
    if (type === 'use-action') {
      this.actions.push(value);
    }

    return directive;
  }

  private parseIsland(attributes: Record<string, string>): IslandNode {
    const src = attributes.src;
    if (!src) {
      this.addError('Island missing required "src" attribute');
      return { src: '', strategy: 'load' };
    }

    this.islands.push(src);

    // Determine loading strategy
    let strategy: IslandNode['strategy'] = 'load';
    for (const [attr, value] of Object.entries(attributes)) {
      if (isValidIslandStrategy(attr)) {
        strategy = ISLAND_STRATEGIES[attr as keyof typeof ISLAND_STRATEGIES];
        break;
      }
    }

    return { src, strategy };
  }

  private parseExpression(expression: string): ExpressionNode {
    // TODO: Implement full expression parsing
    // This is a placeholder for Phase A implementation

    return {
      type: 'variable',
      value: expression
    };
  }

  private parseScript(content: string, type: 'server' | 'client'): ScriptNode {
    const script: ScriptNode = {
      type,
      content
    };

    // Extract exports for server scripts
    if (type === 'server') {
      script.exports = this.extractServerExports(content);
    }

    return script;
  }

  private extractServerExports(content: string): string[] {
    const exports: string[] = [];
    const exportRegex = /export\s+(?:async\s+)?function\s+(\w+)/g;
    let match;

    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]!);
    }

    return exports;
  }

  private addError(message: string, line = 1, column = 1): void {
    this.errors.push({
      message,
      line,
      column,
      filename: this.filename || undefined
    });
  }
}

/**
 * Parse a Plank template source string
 */
export function parse(source: string, options: ParseOptions = {}): ParseResult {
  const parser = new PlankParser(source, options);
  return parser.parse();
}

/**
 * Validate template syntax without full parsing
 */
export function validate(source: string): { valid: boolean; errors: ParseError[] } {
  const result = parse(source);
  return {
    valid: result.errors.length === 0,
    errors: result.errors
  };
}
