/**
 * @fileoverview Working HTML parser for Plank templates
 * A simple, robust implementation
 */

import { TemplateNode, DirectiveNode, IslandNode, ScriptNode } from './grammar.js';
import { getDirectiveType, isValidIslandStrategy, ISLAND_STRATEGIES, isValidDirective } from './grammar.js';

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

export class WorkingHTMLParser {
  private source: string;
  private filename?: string | undefined;
  private dev: boolean;
  private errors: Array<{ message: string; line: number; column: number; filename?: string | undefined }> = [];
  private scripts: ScriptNode[] = [];
  private pos = 0;
  private line = 1;
  private column = 1;

  constructor(source: string, options: HTMLParseOptions = {}) {
    this.source = source;
    this.filename = options.filename;
    this.dev = options.dev || false;
  }

  /**
   * Parse HTML source into AST
   */
  parse(): HTMLParseResult {
    this.errors = [];
    this.scripts = [];
    this.pos = 0;
    this.line = 1;
    this.column = 1;

    try {
      const ast = this.parseTemplate();
      return {
        ast,
        scripts: this.scripts,
        errors: this.errors
      };
    } catch (error) {
      this.addError(`Parse error: ${error instanceof Error ? error.message : String(error)}`);
      return {
        ast: { type: 'template', children: [] },
        scripts: [],
        errors: this.errors
      };
    }
  }

  private parseTemplate(): TemplateNode {
    const template: TemplateNode = {
      type: 'template',
      children: []
    };

    while (this.pos < this.source.length) {
      this.skipWhitespace();

      if (this.pos >= this.source.length) break;

      if (this.source[this.pos] === '<') {
        if (this.source.slice(this.pos, this.pos + 4) === '<!--') {
          this.parseComment();
        } else if (this.source.slice(this.pos, this.pos + 7) === '<script') {
          const script = this.parseScript();
          if (script) {
            this.scripts.push(script);
          }
        } else if (this.source[this.pos + 1] === '/') {
          // Skip closing tags at template level
          this.skipToNext('>');
          this.advance(); // Skip the '>'
        } else {
          const element = this.parseElement();
          if (element) {
            template.children!.push(element);
          }
        }
      } else {
        const text = this.parseText();
        if (text) {
          template.children!.push(text);
        }
      }
    }

    return template;
  }

  private parseElement(): TemplateNode | null {
    if (this.source[this.pos] !== '<') return null;

    this.advance(); // Skip the '<'

    const tagName = this.parseTagName();
    if (!tagName) {
      this.addError('Invalid tag name');
      this.skipToNext('>');
      this.advance(); // Skip the '>'
      return null;
    }

    const attributes = this.parseAttributes();

    if (this.source.slice(this.pos, this.pos + 2) === '/>') {
      // Self-closing tag
      this.advance(2);
      return this.createElement(tagName, attributes, true);
    } else if (this.source[this.pos] === '>') {
      // Regular tag with content
      this.advance(); // Skip the '>'
      const element = this.createElement(tagName, attributes, false);

      // Check if this is a self-closing HTML element
      if (this.isSelfClosingElement(tagName)) {
        // Treat as self-closing even without />
        return element;
      }

      element.children = this.parseElementContent(tagName);
      return element;
    } else {
      this.addError('Invalid tag syntax');
      this.skipToNext('>');
      this.advance(); // Skip the '>'
      return null;
    }
  }

  private parseTagName(): string | null {
    const start = this.pos;
    while (this.pos < this.source.length && /[a-zA-Z0-9-]/.test(this.source[this.pos]!)) {
      this.advance();
    }

    if (this.pos === start) return null;
    return this.source.slice(start, this.pos);
  }

  private parseAttributes(): Record<string, string> {
    const attributes: Record<string, string> = {};

    while (this.pos < this.source.length) {
      this.skipWhitespace();

      if (this.source.slice(this.pos, this.pos + 2) === '/>' || this.source[this.pos] === '>') {
        break;
      }

      const name = this.parseAttributeName();
      if (!name) break;

      let value = '';
      if (this.source[this.pos] === '=') {
        this.advance(); // Skip the '='
        value = this.parseAttributeValue();
      }

      attributes[name] = value;
    }

    return attributes;
  }

  private parseAttributeName(): string | null {
    const start = this.pos;
    while (this.pos < this.source.length && /[a-zA-Z0-9-:]/.test(this.source[this.pos]!)) {
      this.advance();
    }

    if (this.pos === start) return null;
    return this.source.slice(start, this.pos);
  }

  private parseAttributeValue(): string {
    if (this.source[this.pos] === '"') {
      return this.parseQuotedString('"');
    } else if (this.source[this.pos] === "'") {
      return this.parseQuotedString("'");
    } else {
      // Unquoted value
      const start = this.pos;
      while (this.pos < this.source.length && !/[>\s]/.test(this.source[this.pos]!)) {
        this.advance();
      }
      return this.source.slice(start, this.pos);
    }
  }

  private parseQuotedString(quote: string): string {
    this.advance(); // Skip opening quote
    const start = this.pos;

    while (this.pos < this.source.length && this.source[this.pos] !== quote) {
      if (this.source[this.pos] === '\\') {
        this.advance(); // Skip escaped character
      }
      this.advance();
    }

    const value = this.source.slice(start, this.pos);
    if (this.pos < this.source.length) {
      this.advance(); // Skip closing quote
    }

    return value;
  }

  private parseElementContent(tagName: string): TemplateNode[] {
    const children: TemplateNode[] = [];

    while (this.pos < this.source.length) {
      this.skipWhitespace();

      // Check for closing tag
      if (this.source[this.pos] === '<' && this.source[this.pos + 1] === '/') {
        const closingTag = `</${tagName}>`;
        if (this.source.slice(this.pos, this.pos + closingTag.length) === closingTag) {
          this.advance(closingTag.length);
          break;
        }
      }

      if (this.source.slice(this.pos, this.pos + 4) === '<!--') {
        this.parseComment();
      } else if (this.source.slice(this.pos, this.pos + 7) === '<script') {
        const script = this.parseScript();
        if (script) {
          this.scripts.push(script);
        }
      } else if (this.source[this.pos] === '<') {
        const element = this.parseElement();
        if (element) {
          children.push(element);
        }
      } else {
        const text = this.parseText();
        if (text) {
          children.push(text);
        }
      }
    }

    return children;
  }

  private parseText(): TemplateNode | null {
    const start = this.pos;

    while (this.pos < this.source.length && this.source[this.pos] !== '<') {
      this.advance();
    }

    if (this.pos === start) return null;

    const text = this.source.slice(start, this.pos).trim();
    if (!text) return null;

    return {
      type: 'text',
      text
    };
  }

  private parseComment(): void {
    // Skip HTML comment
    while (this.pos < this.source.length && this.source.slice(this.pos, this.pos + 3) !== '-->') {
      this.advance();
    }
    if (this.source.slice(this.pos, this.pos + 3) === '-->') {
      this.advance(3);
    }
  }

  private parseScript(): ScriptNode | null {
    if (this.source.slice(this.pos, this.pos + 7) !== '<script') return null;

    // Skip <script
    this.advance(7);

    const attributes = this.parseAttributes();

    if (this.source[this.pos] !== '>') {
      this.addError('Invalid script tag');
      this.skipToNext('>');
      this.advance(); // Skip the '>'
      return null;
    }

    this.advance(); // Skip the '>'

    // Parse script content
    const start = this.pos;
    while (this.pos < this.source.length && this.source.slice(this.pos, this.pos + 9) !== '</script>') {
      this.advance();
    }

    const content = this.source.slice(start, this.pos);

    if (this.source.slice(this.pos, this.pos + 9) === '</script>') {
      this.advance(9);
    }

    // Determine script type
    const type = attributes.type === 'server' ? 'server' : 'client';

    return {
      type,
      content: content.trim()
    };
  }

  private createElement(tagName: string, attributes: Record<string, string>, selfClosing: boolean): TemplateNode {
    const element: TemplateNode = {
      type: 'element',
      tag: tagName,
      attributes,
      children: []
    };

    // Parse directives
    for (const [name, value] of Object.entries(attributes)) {
      // Check if this looks like a directive but is invalid
      // Skip validation for island loading strategies
      if (name.includes(':') && !isValidDirective(name) && !isValidIslandStrategy(name)) {
        this.addError(`Invalid directive: ${name}`);
      }

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
    return {
      type,
      name,
      value
    };
  }

  private parseIsland(attributes: Record<string, string>): IslandNode {
    const src = attributes.src;
    if (!src) {
      this.addError('Island missing required "src" attribute');
      return { src: '', strategy: 'load' };
    }

    // Determine loading strategy
    let strategy: IslandNode['strategy'] = 'load';
    for (const [attr] of Object.entries(attributes)) {
      if (isValidIslandStrategy(attr)) {
        strategy = ISLAND_STRATEGIES[attr as keyof typeof ISLAND_STRATEGIES];
        break;
      }
    }

    return { src, strategy };
  }

  private advance(count = 1): void {
    for (let i = 0; i < count; i++) {
      if (this.pos < this.source.length) {
        if (this.source[this.pos] === '\n') {
          this.line++;
          this.column = 1;
        } else {
          this.column++;
        }
        this.pos++;
      }
    }
  }

  private skipWhitespace(): void {
    while (this.pos < this.source.length && /\s/.test(this.source[this.pos]!)) {
      this.advance();
    }
  }

  private skipToNext(char: string): void {
    while (this.pos < this.source.length && this.source[this.pos] !== char) {
      this.advance();
    }
  }

  private isSelfClosingElement(tagName: string): boolean {
    const selfClosingTags = [
      'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
      'link', 'meta', 'param', 'source', 'track', 'wbr'
    ];
    return selfClosingTags.includes(tagName.toLowerCase());
  }

  private addError(message: string): void {
    this.errors.push({
      message,
      line: this.line,
      column: this.column,
      filename: this.filename
    });
  }
}

/**
 * Parse HTML source into AST
 */
export function parseHTML(source: string, options: HTMLParseOptions = {}): HTMLParseResult {
  const parser = new WorkingHTMLParser(source, options);
  return parser.parse();
}
