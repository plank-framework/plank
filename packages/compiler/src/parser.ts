/**
 * @fileoverview Plank template parser implementation
 */

import {
  type DirectiveNode,
  type ExpressionNode,
  getDirectiveType,
  ISLAND_STRATEGIES,
  type IslandNode,
  isValidExpression,
  isValidIslandStrategy,
  type ScriptNode,
  type TemplateNode,
} from './grammar.js';
import { parseHTML } from './html-parser.js';

// Re-export types for external use
export type {
  DirectiveNode,
  ExpressionNode,
  ForLoopNode,
  IslandNode,
  ScriptNode,
  TemplateNode,
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
  /** Scripts found in the template */
  scripts: ScriptNode[];
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
  private scripts: ScriptNode[] = [];
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
    this.scripts = [];
    this.dependencies = [];
    this.islands = [];
    this.actions = [];

    try {
      const ast = this.parseTemplate();
      return {
        ast,
        scripts: this.scripts,
        dependencies: this.dependencies,
        islands: this.islands,
        actions: this.actions,
        errors: this.errors,
      };
    } catch (error) {
      this.addError(`Parse error: ${error instanceof Error ? error.message : String(error)}`);
      return {
        ast: { type: 'template', children: [] },
        scripts: [],
        dependencies: [],
        islands: [],
        actions: [],
        errors: this.errors,
      };
    }
  }

  private parseTemplate(): TemplateNode {
    // Use HTML parser to parse the template
    const htmlResult = parseHTML(this.source, {
      dev: this.dev,
      filename: this.filename,
    });

    // Add HTML parsing errors to our error list
    this.errors.push(...htmlResult.errors);

    // Extract scripts from HTML parsing
    this.scripts = htmlResult.scripts;

    // Extract islands and actions from the AST
    this.extractIslands(htmlResult.ast);
    this.extractActions(htmlResult.ast);

    return htmlResult.ast;
  }

  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: <future implementation>
  private parseElement(tagName: string, attributes: Record<string, string>): TemplateNode {
    const element: TemplateNode = {
      type: 'element',
      tag: tagName,
      attributes,
      children: [],
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
      value,
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
    for (const [attr, _value] of Object.entries(attributes)) {
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
      value: expression,
    };
  }

  private extractIslands(node: TemplateNode): void {
    if (node.type === 'element' && node.tag === 'island' && node.island) {
      this.islands.push(node.island.src);
    }

    if (node.children) {
      for (const child of node.children) {
        this.extractIslands(child);
      }
    }
  }

  private extractActions(node: TemplateNode): void {
    if (node.type === 'element' && node.directive?.type === 'use-action') {
      this.actions.push(node.directive.value);
    }

    if (node.children) {
      for (const child of node.children) {
        this.extractActions(child);
      }
    }
  }

  private addError(message: string, line = 1, column = 1): void {
    this.errors.push({
      message,
      line,
      column,
      filename: this.filename || undefined,
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
    errors: result.errors,
  };
}
