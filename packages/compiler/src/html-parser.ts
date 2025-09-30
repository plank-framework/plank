/**
 * @fileoverview Hybrid HTML parser for Plank templates
 * Uses htmlparser2 for robust HTML parsing + custom logic for Plank features
 */

import type { Element, Node, Text } from 'domhandler';
import { parseDocument } from 'htmlparser2';
import {
  type DirectiveNode,
  getDirectiveType,
  ISLAND_STRATEGIES,
  type IslandNode,
  isValidDirective,
  isValidIslandStrategy,
  type ScriptNode,
  type TemplateNode,
} from './grammar.js';

export interface HTMLParseOptions {
  /** Enable development mode with additional debugging info */
  dev?: boolean | undefined;
  /** Source file path for error reporting */
  filename?: string | undefined;
}

export interface HTMLParseResult {
  /** Parsed template AST */
  ast: TemplateNode;
  /** Scripts found in the template */
  scripts: ScriptNode[];
  /** Errors encountered during parsing */
  errors: Array<{ message: string; line: number; column: number; filename?: string | undefined }>;
}

export class HybridHTMLParser {
  private source: string;
  private filename?: string | undefined;
  private dev: boolean;
  private errors: Array<{
    message: string;
    line: number;
    column: number;
    filename?: string | undefined;
  }> = [];
  private scripts: ScriptNode[] = [];

  constructor(source: string, options: HTMLParseOptions = {}) {
    this.source = source;
    this.filename = options.filename;
    this.dev = options.dev || false;
  }

  /**
   * Parse HTML source into AST using hybrid approach
   */
  parse(): HTMLParseResult {
    this.errors = [];
    this.scripts = [];

    try {
      // Step 1: Preprocess curly brace attributes to quoted attributes
      // htmlparser2 doesn't handle attr={value with spaces} correctly
      const preprocessedSource = this.preprocessCurlyBraceAttributes(this.source);

      // Step 2: Parse HTML structure with htmlparser2
      const htmlAst = parseDocument(preprocessedSource, {
        lowerCaseTags: false,
        lowerCaseAttributeNames: false,
        withStartIndices: true,
        withEndIndices: true,
        decodeEntities: true,
      });

      // Step 3: Transform to Plank AST
      const plankAst = this.transformToPlankAST(htmlAst);

      return {
        ast: plankAst,
        scripts: this.scripts,
        errors: this.errors,
      };
    } catch (error) {
      this.addError(`Parse error: ${error instanceof Error ? error.message : String(error)}`, 1, 1);
      return {
        ast: { type: 'template', children: [] },
        scripts: [],
        errors: this.errors,
      };
    }
  }

  /**
   * Preprocess curly brace attributes to quoted attributes
   * Converts attr={value} to attr="{value}" so htmlparser2 can handle them
   */
  private preprocessCurlyBraceAttributes(source: string): string {
    // Match directive attributes with curly braces: attr:name={value}
    // This regex matches:
    // - Directive name (on:, bind:, x:, class:, attr:, use:, client:)
    // - Equals sign
    // - Opening curly brace
    // - Value (anything except closing brace)
    // - Closing curly brace
    return source.replace(
      /([a-zA-Z][a-zA-Z0-9]*:[a-zA-Z][a-zA-Z0-9-]*)=\{([^}]+)\}/g,
      '$1="{$2}"'
    );
  }

  /**
   * Transform htmlparser2 AST to Plank TemplateNode format
   */
  private transformToPlankAST(node: Node): TemplateNode {
    // Handle document/root node
    if (node.type === 'root') {
      const rootNode = node as unknown as { children: Node[] };
      const children = rootNode.children
        .map((child: Node) => this.transformToPlankAST(child))
        .filter((n: TemplateNode | null): n is TemplateNode => n !== null);

      return {
        type: 'template',
        children,
      };
    }

    // Handle text nodes
    if (node.type === 'text') {
      const textNode = node as Text;
      const text = textNode.data.trim();
      if (!text) return null as unknown as TemplateNode; // Skip empty text nodes

      return {
        type: 'text',
        text,
      };
    }

    // Handle script nodes (htmlparser2 treats them as a special type)
    if (node.type === 'script') {
      const element = node as Element;
      const script = this.extractScript(element);
      if (script) {
        this.scripts.push(script);
      }
      return null as unknown as TemplateNode; // Don't include script in AST
    }

    // Handle style nodes (htmlparser2 also treats them as a special type)
    if (node.type === 'style') {
      const element = node as Element;
      // Keep style tags in the AST for rendering
      const content = element.children
        .filter((child): child is Text => child.type === 'text')
        .map((child) => child.data)
        .join('');

      return {
        type: 'element',
        tag: 'style',
        attributes: { ...element.attribs },
        children: [{ type: 'text', text: content }],
      };
    }

    // Handle element nodes
    if (node.type === 'tag') {
      const element = node as Element;
      const { line = 1, column = 1 } = this.getPosition(element);

      // Convert attributes (entities preserved as-is)
      const attributes: Record<string, string> = { ...element.attribs };

      // Parse children
      const children = element.children
        .map((child) => this.transformToPlankAST(child))
        .filter((n): n is TemplateNode => n !== null);

      // Create base element
      const plankNode: TemplateNode = {
        type: 'element',
        tag: element.name,
        attributes,
        children,
      };

      // Process Plank-specific features
      this.processDirectives(plankNode, attributes, line, column);
      this.processIsland(plankNode, element.name, attributes, line, column);

      return plankNode;
    }

    // Handle comments - skip them
    if (node.type === 'comment') {
      return null as unknown as TemplateNode;
    }

    // Unknown node type - skip
    return null as unknown as TemplateNode;
  }

  /**
   * Process Plank directives (on:, bind:, x:if, etc.)
   */
  private processDirectives(
    node: TemplateNode,
    attributes: Record<string, string>,
    line: number,
    column: number
  ): void {
    for (const [name, value] of Object.entries(attributes)) {
      // Check if this looks like a directive but is invalid
      // Skip validation for island loading strategies
      if (name.includes(':') && !isValidDirective(name) && !isValidIslandStrategy(name)) {
        this.addError(`Invalid directive: ${name}`, line, column);
      }

      const directiveType = getDirectiveType(name);
      if (directiveType) {
        node.directive = this.parseDirective(directiveType, name, value);
      }
    }
  }

  /**
   * Process island elements
   */
  private processIsland(
    node: TemplateNode,
    tagName: string,
    attributes: Record<string, string>,
    line: number,
    column: number
  ): void {
    if (tagName !== 'island') return;

    const src = attributes.src;
    if (!src) {
      this.addError('Island missing required "src" attribute', line, column);
      node.island = { src: '', strategy: 'load' };
      return;
    }

    // Determine loading strategy
    let strategy: IslandNode['strategy'] = 'load';
    for (const attr of Object.keys(attributes)) {
      if (isValidIslandStrategy(attr)) {
        strategy = ISLAND_STRATEGIES[attr as keyof typeof ISLAND_STRATEGIES];
        break;
      }
    }

    node.island = { src, strategy };
  }

  /**
   * Extract script node from element
   */
  private extractScript(element: Element): ScriptNode | null {
    const attributes = element.attribs;
    const type = attributes.type === 'server' ? 'server' : 'client';

    // Get script content from text children
    const content = element.children
      .filter((child): child is Text => child.type === 'text')
      .map((child) => child.data)
      .join('')
      .trim();

    const script: ScriptNode = {
      type,
      content,
    };

    // Extract exports for server scripts
    if (type === 'server') {
      script.exports = this.extractServerExports(content);
    }

    return script;
  }

  /**
   * Extract server-side exported functions
   */
  private extractServerExports(content: string): string[] {
    const exports: string[] = [];
    const exportRegex = /export\s+(?:async\s+)?function\s+(\w+)/g;
    let match: RegExpExecArray | null = null;

    match = exportRegex.exec(content);
    while (match !== null) {
      exports.push(match[1] ?? '');
      match = exportRegex.exec(content);
    }

    return exports;
  }

  /**
   * Create directive node
   */
  private parseDirective(type: DirectiveNode['type'], name: string, value: string): DirectiveNode {
    return {
      type,
      name,
      value,
    };
  }

  /**
   * Get position info from node (if available)
   */
  private getPosition(node: Node): { line: number; column: number } {
    // htmlparser2 provides startIndex, we can calculate line/column from source
    if ('startIndex' in node && typeof node.startIndex === 'number') {
      const { line, column } = this.calculateLineColumn(node.startIndex);
      return { line, column };
    }
    return { line: 1, column: 1 };
  }

  /**
   * Calculate line and column from string index
   */
  private calculateLineColumn(index: number): { line: number; column: number } {
    let line = 1;
    let column = 1;

    for (let i = 0; i < index && i < this.source.length; i++) {
      if (this.source[i] === '\n') {
        line++;
        column = 1;
      } else {
        column++;
      }
    }

    return { line, column };
  }

  /**
   * Add error to error list
   */
  private addError(message: string, line: number, column: number): void {
    this.errors.push({
      message,
      line,
      column,
      filename: this.filename,
    });
  }
}

/**
 * Parse HTML source into AST using hybrid approach
 */
export function parseHTML(source: string, options: HTMLParseOptions = {}): HTMLParseResult {
  const parser = new HybridHTMLParser(source, options);
  return parser.parse();
}
