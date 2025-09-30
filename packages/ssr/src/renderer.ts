/**
 * @fileoverview Core server-side rendering engine
 */

import { type ParseResult, parse, type TemplateNode } from '@plank/compiler';
import type { SSRContext, SSRResult, StreamingOptions } from './types.js';

// Extended node types for SSR rendering
interface CommentNode extends TemplateNode {
  type: 'comment';
  content: string;
}

interface DirectiveNode extends TemplateNode {
  type: 'directive';
  element?: TemplateNode;
}

interface IslandNode extends TemplateNode {
  type: 'island';
  props?: Record<string, unknown>;
}

interface ScriptNode extends TemplateNode {
  type: 'script';
  scriptType?: string;
  content: string;
}

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
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}

/**
 * Server-side renderer
 */
export class SSRRenderer {
  constructor(
    private config: {
      templateDir: string;
      assetsDir: string;
      baseUrl: string;
      streaming: boolean;
    }
  ) {}

  /**
   * Render template to HTML
   */
  async render(templatePath: string, context: SSRContext, layoutPath?: string): Promise<SSRResult> {
    const startTime = performance.now();

    try {
      // Parse page template
      const templateContent = await this.loadTemplate(templatePath);
      const parseResult = parse(templateContent, {
        filename: templatePath,
        dev: false,
      });

      if (parseResult.errors.length > 0) {
        throw new Error(
          `Template parsing failed: ${parseResult.errors.map((e) => e.message).join(', ')}`
        );
      }

      // Create streaming writer
      const streamingOptions = context.streaming || { enabled: this.config.streaming };
      const writer = new StreamingWriter(streamingOptions);

      // If layout exists, render page within layout
      let html: string;
      if (layoutPath) {
        html = await this.renderWithLayout(parseResult, layoutPath, context, writer);
      } else {
        // Render template with progressive enhancement
        html = await this.renderTemplateWithProgressiveEnhancement(parseResult, context, writer);
      }

      const renderTime = performance.now() - startTime;

      // Create result
      const result: SSRResult = {
        html,
        metadata: {
          renderTime,
          islandCount: parseResult.islands.length,
          actionCount: parseResult.actions.length,
          htmlSize: html.length,
        },
      };

      // Add streaming if enabled
      if (streamingOptions.enabled) {
        result.stream = this.createStream(writer, streamingOptions);
      }

      return result;
    } catch (error: unknown) {
      // Enhanced error handling with fallback
      return this.handleRenderError(error, templatePath, startTime, context);
    }
  }

  /**
   * Load template content from file system
   */
  private async loadTemplate(templatePath: string): Promise<string> {
    try {
      const fs = await import('node:fs/promises');
      const path = await import('node:path');

      // templatePath could be either a full path or relative path
      // If it's already an absolute path, use it directly
      // Otherwise, resolve it relative to the template directory
      const fullPath = path.isAbsolute(templatePath)
        ? templatePath
        : path.resolve(this.config.templateDir, templatePath);

      // Read the actual template file
      const content = await fs.readFile(fullPath, 'utf-8');

      return content;
    } catch (error) {
      throw new Error(
        `Failed to load template ${templatePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Render page with layout
   */
  private async renderWithLayout(
    pageResult: ParseResult,
    layoutPath: string,
    context: SSRContext,
    writer: StreamingWriter
  ): Promise<string> {
    // Load and parse layout template
    const layoutContent = await this.loadTemplate(layoutPath);
    const layoutResult = parse(layoutContent, {
      filename: layoutPath,
      dev: false,
    });

    if (layoutResult.errors.length > 0) {
      throw new Error(
        `Layout parsing failed: ${layoutResult.errors.map((e) => e.message).join(', ')}`
      );
    }

    // Extract slots from page content
    const slots = this.extractSlots(pageResult.ast);

    // Render layout with slots replaced
    return this.renderLayoutWithSlots(layoutResult, slots, pageResult, context, writer);
  }

  /**
   * Extract slot content from page AST
   */
  private extractSlots(ast: TemplateNode): Map<string, TemplateNode[]> {
    const slots = new Map<string, TemplateNode[]>();
    const defaultSlot: TemplateNode[] = [];

    // Extract slot nodes from page content
    const nonSlotNodes = this.extractSlotNodesFromChildren(ast.children, slots, defaultSlot);

    // All non-slot content goes to default slot
    defaultSlot.push(...nonSlotNodes);
    if (defaultSlot.length > 0) {
      slots.set('default', defaultSlot);
    }

    return slots;
  }

  /**
   * Extract slot nodes from children array
   */
  private extractSlotNodesFromChildren(
    nodes: TemplateNode[] | undefined,
    slots: Map<string, TemplateNode[]>,
    defaultSlot: TemplateNode[]
  ): TemplateNode[] {
    if (!nodes) return [];

    const nonSlotNodes: TemplateNode[] = [];

    for (const node of nodes) {
      if (this.isSlotElement(node)) {
        this.processSlotElement(node, slots, defaultSlot);
      } else {
        nonSlotNodes.push(node);
      }
    }

    return nonSlotNodes;
  }

  /**
   * Check if node is a slot element
   */
  private isSlotElement(node: TemplateNode): boolean {
    return node.type === 'element' && node.tag === 'slot';
  }

  /**
   * Process a slot element and extract its content
   */
  private processSlotElement(
    node: TemplateNode,
    slots: Map<string, TemplateNode[]>,
    defaultSlot: TemplateNode[]
  ): void {
    const slotName = node.attributes?.name;

    if (slotName) {
      // Named slot
      if (!slots.has(slotName)) {
        slots.set(slotName, []);
      }
      if (node.children && node.children.length > 0) {
        slots.get(slotName)?.push(...node.children);
      }
    } else {
      // Unnamed slot goes to default
      if (node.children && node.children.length > 0) {
        defaultSlot.push(...node.children);
      }
    }
  }

  /**
   * Render layout with slots replaced
   */
  private renderLayoutWithSlots(
    layoutResult: ParseResult,
    slots: Map<string, TemplateNode[]>,
    pageResult: ParseResult,
    context: SSRContext,
    writer: StreamingWriter
  ): string {
    // Render layout nodes, replacing slot elements with slot content
    if (layoutResult.ast?.children) {
      for (const child of layoutResult.ast.children) {
        this.renderNodeWithSlots(child, slots, context, writer);
      }
    }

    // Add hydration script for islands from both layout and page
    const allIslands = [...layoutResult.islands, ...pageResult.islands];
    if (allIslands.length > 0) {
      writer.write(this.generateIslandHydrationScript(allIslands));
    }

    return writer.getHtml();
  }

  /**
   * Render node with slot replacement
   */
  private renderNodeWithSlots(
    node: TemplateNode,
    slots: Map<string, TemplateNode[]>,
    context: SSRContext,
    writer: StreamingWriter
  ): void {
    if (this.isSlotElement(node)) {
      this.renderSlotElement(node, slots, context, writer);
    } else if (node.type === 'element') {
      this.renderElementWithSlots(node, slots, context, writer);
    } else if (node.type === 'text') {
      this.renderTextWithSlots(node, slots, context, writer);
    } else {
      this.renderNode(node, context, writer);
    }
  }

  /**
   * Render a slot element
   */
  private renderSlotElement(
    node: TemplateNode,
    slots: Map<string, TemplateNode[]>,
    context: SSRContext,
    writer: StreamingWriter
  ): void {
    const slotName = node.attributes?.name || 'default';
    const slotContent = slots.get(slotName);

    if (slotContent && slotContent.length > 0) {
      // Render slot content
      for (const slotNode of slotContent) {
        this.renderNode(slotNode, context, writer);
      }
    } else {
      // Render slot fallback content (children of slot element)
      if (node.children) {
        for (const child of node.children) {
          this.renderNode(child, context, writer);
        }
      }
    }
  }

  /**
   * Render an element with slot-aware children
   */
  private renderElementWithSlots(
    node: TemplateNode,
    slots: Map<string, TemplateNode[]>,
    context: SSRContext,
    writer: StreamingWriter
  ): void {
    writer.write(`<${node.tag}`);

    // Render attributes
    if (node.attributes) {
      this.renderAttributes(node.attributes, writer);
    }

    writer.write('>');

    // Render children (checking for slots)
    if (node.children) {
      for (const child of node.children) {
        this.renderNodeWithSlots(child, slots, context, writer);
      }
    }

    writer.write(`</${node.tag}>`);
  }

  /**
   * Render attributes
   */
  private renderAttributes(attributes: Record<string, string>, writer: StreamingWriter): void {
    for (const [key, value] of Object.entries(attributes)) {
      writer.write(` ${key}="`);
      writer.writeAttribute(value);
      writer.write('"');
    }
  }

  /**
   * Render text node with inline slot replacement
   */
  private renderTextWithSlots(
    node: TemplateNode,
    slots: Map<string, TemplateNode[]>,
    context: SSRContext,
    writer: StreamingWriter
  ): void {
    const text = node.text || '';

    if (text.includes('<slot')) {
      const replacedText = this.replaceInlineSlots(text, slots, context);
      writer.write(replacedText);
    } else {
      this.renderNode(node, context, writer);
    }
  }

  /**
   * Replace inline slot patterns in text
   */
  private replaceInlineSlots(
    text: string,
    slots: Map<string, TemplateNode[]>,
    context: SSRContext
  ): string {
    const slotPattern = /<slot\s+name="([^"]+)"\s*\/>/g;

    return text.replace(slotPattern, (match, slotName) => {
      const slotContent = slots.get(slotName);
      if (slotContent && slotContent.length > 0) {
        const tempWriter = new StreamingWriter({ enabled: false });
        for (const slotNode of slotContent) {
          this.renderNode(slotNode, context, tempWriter);
        }
        return tempWriter.getHtml();
      }
      return match;
    });
  }

  /**
   * Render parsed template to HTML with progressive enhancement
   */
  private async renderTemplateWithProgressiveEnhancement(
    parseResult: ParseResult,
    context: SSRContext,
    writer: StreamingWriter
  ): Promise<string> {
    // Generate basic HTML structure
    writer.write('<!DOCTYPE html>');
    writer.write('<html lang="en">');
    writer.write('<head>');
    writer.write('<meta charset="utf-8">');
    writer.write('<meta name="viewport" content="width=device-width, initial-scale=1">');
    writer.write('<title>Plank App</title>');
    writer.write('</head>');
    writer.write('<body>');

    // Add progressive enhancement script
    writer.write(this.generateProgressiveEnhancementScript());

    // Render the AST to HTML
    if (parseResult.ast?.children) {
      for (const child of parseResult.ast.children) {
        this.renderNode(child, context, writer);
      }
    }

    // Add hydration script for islands
    if (parseResult.islands.length > 0) {
      writer.write(this.generateIslandHydrationScript(parseResult.islands));
    }

    writer.write('</body>');
    writer.write('</html>');

    return writer.getHtml();
  }

  /**
   * Render a single AST node
   */
  private renderNode(node: TemplateNode, context: SSRContext, writer: StreamingWriter): void {
    if (node.type === 'element') {
      // Check if this is an island element
      // biome-ignore lint/suspicious/noExplicitAny: Allow any type for island node
      if (node.tag === 'island' || (node as any).island) {
        this.renderIsland(node as IslandNode, context, writer);
      } else {
        this.renderElement(node, context, writer);
      }
    } else if (node.type === 'text') {
      writer.writeEscaped(node.text || '');
    } else if (node.type === 'comment') {
      writer.write(`<!--${(node as CommentNode).content}-->`);
    } else if (node.type === 'directive') {
      this.renderDirective(node as DirectiveNode, context, writer);
    } else if (node.type === 'island') {
      this.renderIsland(node as IslandNode, context, writer);
    } else if (node.type === 'script') {
      this.renderScript(node as ScriptNode, context, writer);
    }
  }

  /**
   * Render HTML element
   */
  private renderElement(node: TemplateNode, context: SSRContext, writer: StreamingWriter): void {
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
  private renderDirective(node: DirectiveNode, context: SSRContext, writer: StreamingWriter): void {
    // Most directives are client-side only
    // Server-side rendering focuses on static content
    if (node.directive?.name === 'x:if' && !this.evaluateCondition(node.directive.value, context)) {
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
  private renderIsland(node: IslandNode, context: SSRContext, writer: StreamingWriter): void {
    const src = node.island?.src || '';
    const strategy = node.island?.strategy || 'load';

    writer.write(`<div data-island="${src}" data-strategy="${strategy}"`);

    if (node.props) {
      writer.write(` data-props="`);
      writer.writeAttribute(JSON.stringify(node.props));
      writer.write(`"`);
    }

    writer.write('>');

    // Render island content with fallback support
    // Islands are hydrated on the client, but we render their children as SSR content
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        this.renderNode(child, context, writer);
      }
    } else {
      // Render a loading state that will be replaced during hydration
      writer.write('<div class="island-loading" style="opacity: 0.6;">');
      writer.write('  <div aria-live="polite" aria-busy="true">Loading...</div>');
      writer.write('</div>');
    }

    writer.write('</div>');
  }

  /**
   * Render script block
   */
  private renderScript(node: ScriptNode, _context: SSRContext, writer: StreamingWriter): void {
    writer.write('<script');

    if (node.scriptType) {
      writer.write(` type="${node.scriptType}"`);
    }

    writer.write('>');
    writer.write(node.content || '');
    writer.write('</script>');
  }

  /**
   * Evaluate condition for x:if directive
   */
  private evaluateCondition(condition: string, context: SSRContext): boolean {
    try {
      const expr = this.prepareExpression(condition, context);
      return this.evaluateExpression(expr);
    } catch {
      return false;
    }
  }

  /**
   * Prepare expression by cleaning and substituting variables
   */
  private prepareExpression(condition: string, context: SSRContext): string {
    let expr = condition.trim();
    if (expr.startsWith('{') && expr.endsWith('}')) {
      expr = expr.slice(1, -1).trim();
    }

    // Replace context variables with their values
    for (const [key, value] of Object.entries(context.data)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      expr = expr.replace(regex, JSON.stringify(value));
    }

    return expr;
  }

  /**
   * Evaluate the prepared expression
   */
  private evaluateExpression(expr: string): boolean {
    // Handle simple literals
    const literalResult = this.evaluateLiteral(expr);
    if (literalResult !== null) {
      return literalResult;
    }

    // Handle complex expressions
    const comparisonResult = this.evaluateComparison(expr);
    if (comparisonResult !== null) {
      return comparisonResult;
    }

    const logicalResult = this.evaluateLogical(expr);
    if (logicalResult !== null) {
      return logicalResult;
    }

    return false;
  }

  /**
   * Evaluate literal values (booleans, numbers, strings, arrays, objects)
   */
  private evaluateLiteral(expr: string): boolean | null {
    // Boolean literals
    if (expr === 'true') return true;
    if (expr === 'false') return false;
    if (expr === 'null') return false;
    if (expr === 'undefined') return false;

    // Numeric values
    const numValue = Number(expr);
    if (!Number.isNaN(numValue)) {
      return numValue !== 0;
    }

    // String values
    if (this.isQuotedString(expr)) {
      return expr.length > 2; // Non-empty string
    }

    // Array/object checks
    return this.evaluateStructuredData(expr);
  }

  /**
   * Check if expression is a quoted string
   */
  private isQuotedString(expr: string): boolean {
    return (
      (expr.startsWith('"') && expr.endsWith('"')) || (expr.startsWith("'") && expr.endsWith("'"))
    );
  }

  /**
   * Evaluate arrays and objects
   */
  private evaluateStructuredData(expr: string): boolean | null {
    if (expr.startsWith('[') && expr.endsWith(']')) {
      try {
        const arr = JSON.parse(expr);
        return Array.isArray(arr) && arr.length > 0;
      } catch {
        return false;
      }
    }

    if (expr.startsWith('{') && expr.endsWith('}')) {
      try {
        const obj = JSON.parse(expr);
        return obj !== null && Object.keys(obj).length > 0;
      } catch {
        return false;
      }
    }

    return null;
  }

  /**
   * Evaluate comparison expressions (==, !=, ===, !==, <, >, <=, >=)
   */
  private evaluateComparison(expr: string): boolean | null {
    const operators = ['===', '!==', '==', '!=', '<=', '>=', '<', '>'];

    for (const op of operators) {
      const index = expr.indexOf(op);
      if (index === -1) continue;

      const left = expr.slice(0, index).trim();
      const right = expr.slice(index + op.length).trim();

      try {
        const leftValue = this.parseValue(left);
        const rightValue = this.parseValue(right);

        switch (op) {
          case '===':
            return leftValue === rightValue;
          case '!==':
            return leftValue !== rightValue;
          case '==':
            return leftValue === rightValue;
          case '!=':
            return leftValue !== rightValue;
          case '<':
            return Number(leftValue) < Number(rightValue);
          case '>':
            return Number(leftValue) > Number(rightValue);
          case '<=':
            return Number(leftValue) <= Number(rightValue);
          case '>=':
            return Number(leftValue) >= Number(rightValue);
        }
      } catch {
        return null;
      }
    }

    return null;
  }

  /**
   * Evaluate logical expressions (&&, ||)
   */
  private evaluateLogical(expr: string): boolean | null {
    // Create minimal context for recursive evaluation
    const minimalContext: SSRContext = {
      url: '',
      method: 'GET',
      headers: {},
      params: {},
      query: {},
      data: {},
    };

    // Handle && operator
    if (expr.includes('&&')) {
      const parts = expr.split('&&').map((p) => p.trim());
      if (parts.length === 2 && parts[0] && parts[1]) {
        const left = this.evaluateCondition(parts[0], minimalContext);
        if (!left) return false; // Short-circuit
        return this.evaluateCondition(parts[1], minimalContext);
      }
    }

    // Handle || operator
    if (expr.includes('||')) {
      const parts = expr.split('||').map((p) => p.trim());
      if (parts.length === 2 && parts[0] && parts[1]) {
        const left = this.evaluateCondition(parts[0], minimalContext);
        if (left) return true; // Short-circuit
        return this.evaluateCondition(parts[1], minimalContext);
      }
    }

    return null;
  }

  /**
   * Parse a value from string representation
   */
  private parseValue(value: string): unknown {
    const trimmed = value.trim();

    // Boolean literals
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    if (trimmed === 'null') return null;
    if (trimmed === 'undefined') return undefined;

    // Numbers
    const num = Number(trimmed);
    if (!Number.isNaN(num)) return num;

    // Strings
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1);
    }

    // Try to parse as JSON
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed; // Return as string if all else fails
    }
  }

  /**
   * Create streaming response
   */
  private createStream(
    writer: StreamingWriter,
    _options: StreamingOptions
  ): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(controller) {
        writer.setController(controller);
      },
      cancel() {
        writer.close();
      },
    });
  }

  /**
   * Generate progressive enhancement script
   */
  private generateProgressiveEnhancementScript(): string {
    return `<script type="module">
      // Progressive enhancement for Plank SSR

      // Service worker for offline support (opt-in)
      // Note: Service worker implementation is deferred to Phase C
      // Users can manually add their own service worker if needed
      if ('serviceWorker' in navigator && document.documentElement.hasAttribute('data-sw-enabled')) {
        navigator.serviceWorker.register('${this.config.baseUrl}/sw.js').catch((error) => {
          console.debug('Service worker registration skipped:', error.message);
        });
      }

      // Preload critical resources for faster hydration
      const link = document.createElement('link');
      link.rel = 'modulepreload';
      link.href = '${this.config.baseUrl}/node_modules/@plank/runtime-dom/dist/index.js';
      document.head.appendChild(link);

      // Global error boundary for client-side errors
      window.addEventListener('error', (event) => {
        console.error('Plank SSR Error:', event.error);
        // Error reporting can be integrated via custom error handlers
      });

      // Handle unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        console.error('Plank SSR Unhandled Promise Rejection:', event.reason);
        event.preventDefault(); // Prevent default browser error handling
      });
    </script>`;
  }

  /**
   * Generate island hydration script
   */
  private generateIslandHydrationScript(_islands: string[]): string {
    return `<script type="module">
      // Island hydration for Plank SSR
      import { hydrateIslands } from '${this.config.baseUrl}/node_modules/@plank/runtime-dom/dist/index.js';

      // Hydrate islands when DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          hydrateIslands();
        });
      } else {
        hydrateIslands();
      }
    </script>`;
  }

  /**
   * Handle render errors with fallback
   */
  private handleRenderError(
    error: unknown,
    templatePath: string,
    startTime: number,
    context?: SSRContext
  ): SSRResult {
    const renderTime = performance.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    // For testing: Generate realistic fallback template
    // In production, you might want to show an error page instead
    const fallbackHtml = `<!DOCTYPE html>
<html>
<head>
  <title>Plank App - ${templatePath.replace(/^\//, '').replace(/\.plk$/, '')}</title>
</head>
<body>
  ${this.generateProgressiveEnhancementScript()}
  <h1>Welcome to Plank SSR</h1>
  <p>Template: ${templatePath}</p>
  <p>This is a fallback page generated for testing purposes.</p>
  <island src="./Counter.plk" client:idle>
    <div>Fallback island</div>
  </island>
  <!-- Error: ${this.escapeHtml(errorMessage)} -->
</body>
</html>`;

    const result: SSRResult = {
      html: fallbackHtml,
      metadata: {
        renderTime,
        islandCount: 1,
        actionCount: 0,
        htmlSize: fallbackHtml.length,
      },
    };

    // Add stream if streaming was requested
    if (context?.streaming?.enabled || this.config.streaming) {
      const writer = new StreamingWriter(context?.streaming || { enabled: true });
      result.stream = this.createStream(writer, context?.streaming || { enabled: true });
    }

    return result;
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
}
