/**
 * @fileoverview Core server-side rendering engine
 */

import { parse, type ParseResult } from '@plank/compiler';
import type { SSRContext, SSRResult, TemplateRenderer, StreamingOptions } from './types.js';

/**
 * HTML streaming writer
 */
export class StreamingWriter {
  private chunks: string[] = [];
  private encoder = new TextEncoder();
  private controller?: ReadableStreamDefaultController<Uint8Array>;

  constructor(private options: StreamingOptions) {}

  /**
   * Write HTML chunk to stream
   */
  write(chunk: string): void {
    if (this.options.enabled && this.controller) {
      this.controller.enqueue(this.encoder.encode(chunk));
    } else {
      this.chunks.push(chunk);
    }
  }

  /**
   * Write HTML with proper escaping
   */
  writeEscaped(text: string): void {
    this.write(this.escapeHtml(text));
  }

  /**
   * Write attribute value with proper escaping
   */
  writeAttribute(value: string): void {
    this.write(this.escapeAttribute(value));
  }

  /**
   * Get accumulated HTML if not streaming
   */
  getHtml(): string {
    return this.chunks.join('');
  }

  /**
   * Set stream controller for streaming mode
   */
  setController(controller: ReadableStreamDefaultController<Uint8Array>): void {
    this.controller = controller;
  }

  /**
   * Close the stream
   */
  close(): void {
    if (this.controller) {
      this.controller.close();
    }
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Escape attribute value
   */
  private escapeAttribute(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Escape attribute value (alias for consistency)
   */
  private escapeAttributeValue(value: string): string {
    return this.escapeAttribute(value);
  }
}

/**
 * Server-side renderer
 */
export class SSRRenderer {
  constructor(private config: {
    templateDir: string;
    assetsDir: string;
    baseUrl: string;
    streaming: boolean;
  }) {}

  /**
   * Render template to HTML
   */
  async render(templatePath: string, context: SSRContext): Promise<SSRResult> {
    const startTime = performance.now();
    
    try {
      // Parse template
      const templateContent = await this.loadTemplate(templatePath);
      const parseResult = parse(templateContent, {
        filename: templatePath,
        dev: false
      });

      if (parseResult.errors.length > 0) {
        throw new Error(`Template parsing failed: ${parseResult.errors.map(e => e.message).join(', ')}`);
      }

      // Create streaming writer
      const streamingOptions = context.streaming || { enabled: this.config.streaming };
      const writer = new StreamingWriter(streamingOptions);

      // Render template
      const html = await this.renderTemplate(parseResult, context, writer);
      
      const renderTime = performance.now() - startTime;

      // Create result
      const result: SSRResult = {
        html,
        metadata: {
          renderTime,
          islandCount: parseResult.islands.length,
          actionCount: parseResult.actions.length,
          htmlSize: html.length
        }
      };

      // Add streaming if enabled
      if (streamingOptions.enabled) {
        result.stream = this.createStream(writer, streamingOptions);
      }

      return result;
    } catch (error: unknown) {
      throw new Error(`SSR rendering failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load template content
   */
  private async loadTemplate(templatePath: string): Promise<string> {
    // In a real implementation, this would load from file system
    // For now, return a placeholder with valid HTML structure
    return `<html>
<head>
  <title>Plank App</title>
</head>
<body>
  <h1>Hello from Plank SSR!</h1>
  <p>Template: ${templatePath}</p>
</body>
</html>`;
  }

  /**
   * Render parsed template to HTML
   */
  private async renderTemplate(
    parseResult: ParseResult,
    context: SSRContext,
    writer: StreamingWriter
  ): Promise<string> {
    // Render the AST to HTML
    if (parseResult.ast && parseResult.ast.children) {
      for (const child of parseResult.ast.children) {
        this.renderNode(child, context, writer);
      }
    }
    return writer.getHtml();
  }

  /**
   * Render a single AST node
   */
  private renderNode(node: any, context: SSRContext, writer: StreamingWriter): void {
    if (node.type === 'element') {
      this.renderElement(node, context, writer);
    } else if (node.type === 'text') {
      writer.writeEscaped(node.text || node.content || '');
    } else if (node.type === 'comment') {
      writer.write(`<!--${node.content}-->`);
    } else if (node.type === 'directive') {
      this.renderDirective(node, context, writer);
    } else if (node.type === 'island') {
      this.renderIsland(node, context, writer);
    } else if (node.type === 'script') {
      this.renderScript(node, context, writer);
    }
  }

  /**
   * Render HTML element
   */
  private renderElement(node: any, context: SSRContext, writer: StreamingWriter): void {
    writer.write(`<${node.tag}`);
    
    // Render attributes
    if (node.attributes) {
      for (const [name, value] of Object.entries(node.attributes)) {
        writer.write(` ${name}="`);
        writer.writeAttribute(String(value));
        writer.write('"');
      }
    }

    // Self-closing or with children
    if (node.children && node.children.length > 0) {
      writer.write('>');
      for (const child of node.children) {
        this.renderNode(child, context, writer);
      }
      writer.write(`</${node.tag}>`);
    } else {
      writer.write(' />');
    }
  }

  /**
   * Render directive (server-side)
   */
  private renderDirective(node: any, context: SSRContext, writer: StreamingWriter): void {
    // Most directives are client-side only
    // Server-side rendering focuses on static content
    if (node.name === 'x:if' && !this.evaluateCondition(node.value, context)) {
      return; // Skip rendering if condition is false
    }
    
    // For other directives, render the element without the directive
    if (node.element) {
      this.renderElement(node.element, context, writer);
    }
  }

  /**
   * Render island component
   */
  private renderIsland(node: any, context: SSRContext, writer: StreamingWriter): void {
    const islandId = `island-${Math.random().toString(36).substr(2, 9)}`;
    
    writer.write(`<div data-island="${islandId}" data-src="${node.src}"`);
    
    if (node.strategy) {
      writer.write(` data-strategy="${node.strategy}"`);
    }
    
    if (node.props) {
      writer.write(` data-props="`);
      writer.writeAttribute(JSON.stringify(node.props));
      writer.write(`"`);
    }
    
    writer.write('>');
    
    // Render placeholder content
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        this.renderNode(child, context, writer);
      }
    } else {
      writer.write('<!-- Island placeholder -->');
    }
    
    writer.write('</div>');
  }

  /**
   * Render script block
   */
  private renderScript(node: any, context: SSRContext, writer: StreamingWriter): void {
    writer.write('<script');
    
    if (node.type) {
      writer.write(` type="${node.type}"`);
    }
    
    writer.write('>');
    writer.write(node.content);
    writer.write('</script>');
  }

  /**
   * Evaluate condition for x:if directive
   */
  private evaluateCondition(condition: string, context: SSRContext): boolean {
    // Simple condition evaluation
    // In a real implementation, this would be more sophisticated
    try {
      // Replace context variables
      let expr = condition;
      for (const [key, value] of Object.entries(context.data)) {
        expr = expr.replace(new RegExp(`\\b${key}\\b`, 'g'), JSON.stringify(value));
      }
      
      // Evaluate the expression
      return Boolean(eval(expr));
    } catch {
      return false;
    }
  }

  /**
   * Create streaming response
   */
  private createStream(writer: StreamingWriter, options: StreamingOptions): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(controller) {
        writer.setController(controller);
      },
      cancel() {
        writer.close();
      }
    });
  }
}
