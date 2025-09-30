/**
 * @fileoverview Code generation for Plank templates
 * Converts AST to JavaScript code for server and client
 */

import type { DirectiveNode, IslandNode, ScriptNode, TemplateNode } from './grammar.js';
import type { ParseResult } from './parser.js';

export interface CodegenOptions {
  /** Target environment: 'server' or 'client' */
  target: 'server' | 'client';
  /** Enable development mode with additional debugging info */
  dev?: boolean | undefined;
  /** Source file path for error reporting */
  filename?: string | undefined;
  /** Enable source maps */
  sourceMap?: boolean | undefined;
}

export interface CodegenResult {
  /** Generated JavaScript code */
  code: string;
  /** Source map if enabled */
  map?: string;
  /** Dependencies required by the generated code */
  dependencies: string[];
  /** Islands that need to be loaded */
  islands: string[];
  /** Server actions used */
  actions: string[];
  /** Code-split chunks for islands */
  chunks: IslandChunk[];
}

export interface IslandChunk {
  /** Island source path */
  src: string;
  /** Loading strategy */
  strategy: string;
  /** Generated chunk code */
  code: string;
  /** Dependencies for this chunk */
  dependencies: string[];
  /** Chunk ID for dynamic imports */
  id: string;
}

/**
 * DOM operation types for IR generation
 */
export type DOMOperation =
  | { type: 'createElement'; tag: string; attributes?: Record<string, string> | undefined }
  | { type: 'createText'; content: string }
  | { type: 'setAttribute'; name: string; value: string }
  | { type: 'setTextContent'; content: string }
  | { type: 'appendChild'; child: DOMOperation }
  | {
      type: 'createIsland';
      src: string;
      strategy: string;
      props?: Record<string, unknown> | undefined;
    }
  | { type: 'createDirective'; directive: DirectiveNode }
  | { type: 'createScript'; script: ScriptNode };

/**
 * Generate JavaScript code from parsed template
 */
export function generateCode(parseResult: ParseResult, options: CodegenOptions): CodegenResult {
  const generator = new CodeGenerator(options);
  return generator.generate(parseResult);
}

/**
 * Generate DOM operation IR from AST
 */
export function generateDOMIR(ast: TemplateNode): DOMOperation[] {
  const generator = new DOMIRGenerator();
  return generator.generate(ast);
}

class CodeGenerator {
  private imports: Set<string> = new Set();
  private islands: Set<string> = new Set();
  private actions: Set<string> = new Set();
  private chunks: IslandChunk[] = [];
  private code: string[] = [];
  private indentLevel = 0;

  constructor(private options: CodegenOptions) {}

  generate(parseResult: ParseResult): CodegenResult {
    this.reset();

    // Generate imports
    this.generateImports();

    // Generate main function
    this.generateMainFunction(parseResult.ast);

    // Generate helper functions
    this.generateHelpers();

    return {
      code: this.code.join('\n'),
      dependencies: Array.from(this.imports),
      islands: Array.from(this.islands),
      actions: Array.from(this.actions),
      chunks: this.chunks,
    };
  }

  private reset(): void {
    this.imports.clear();
    this.islands.clear();
    this.actions.clear();
    this.chunks = [];
    this.code = [];
    this.indentLevel = 0;
  }

  private generateImports(): void {
    if (this.options.target === 'client') {
      this.addImport('@plank/runtime-dom', ['signal', 'computed', 'effect']);
      this.addImport('@plank/runtime-dom', ['bindText', 'bindAttribute', 'bindProperty']);
    } else {
      this.addImport('@plank/ssr', ['SSRRenderer', 'StreamingWriter']);
    }
  }

  private addImport(module: string, imports: string[]): void {
    this.imports.add(module);
    this.code.push(`import { ${imports.join(', ')} } from '${module}';`);
  }

  private generateMainFunction(ast: TemplateNode): void {
    this.code.push('');
    this.code.push(`export function render(context = {}) {`);
    this.indentLevel++;

    if (this.options.target === 'server') {
      this.generateServerRender(ast);
    } else {
      this.generateClientRender(ast);
    }

    this.indentLevel--;
    this.code.push('}');
  }

  private generateServerRender(_ast: TemplateNode): void {
    this.addLine('const writer = new StreamingWriter({ enabled: true });');
    this.addLine('const renderer = new SSRRenderer({');
    this.addLine('  templateDir: "./app/routes",');
    this.addLine('  assetsDir: "./public",');
    this.addLine('  baseUrl: "/",');
    this.addLine('  streaming: true');
    this.addLine('});');
    this.addLine('');
    this.addLine('return renderer.render(ast, context);');
  }

  private generateClientRender(_ast: TemplateNode): void {
    this.addLine('const container = document.createElement("div");');
    this.addLine('const signals = new Map();');
    this.addLine('');
    this.addLine('// Render template');
    this.generateNodeCode(_ast);
    this.addLine('');
    this.addLine('return container;');
  }

  private generateNodeCode(node: TemplateNode): void {
    switch (node.type) {
      case 'template':
        this.generateTemplateCode(node);
        break;
      case 'element':
        this.generateElementCode(node, 'container');
        break;
      case 'text':
        this.generateTextCode(node);
        break;
      case 'directive':
        this.generateDirectiveCode(node);
        break;
      case 'island':
        this.generateIslandCode(node);
        break;
      case 'script':
        this.generateScriptCode(node);
        break;
    }
  }

  private generateTemplateCode(node: TemplateNode): void {
    if (node.children) {
      for (const child of node.children) {
        this.generateNodeCode(child);
      }
    }
  }

  private generateElementCode(node: TemplateNode, parentVar = 'container'): string {
    // Check if this is an island element
    if (node.tag === 'island') {
      this.generateIslandCode(node);
      return '';
    }

    // Check if element has x:for directive - handle differently
    if (node.attributes?.['x:for']) {
      return this.generateForLoopElement(node, parentVar);
    }

    const elementVar = `element_${Math.random().toString(36).substr(2, 9)}`;
    this.addLine(`const ${elementVar} = document.createElement("${node.tag}");`);

    // Generate attributes
    if (node.attributes) {
      for (const [name, value] of Object.entries(node.attributes)) {
        if (this.isDirective(name)) {
          this.generateDirectiveBinding(elementVar, name, value);
        } else {
          this.addLine(`${elementVar}.setAttribute("${name}", "${value}");`);
        }
      }
    }

    // Generate children
    if (node.children) {
      for (const child of node.children) {
        const childVar = this.generateNodeCodeWithReturn(child, elementVar);
        if (childVar) {
          this.addLine(`${elementVar}.appendChild(${childVar});`);
        }
      }
    }

    this.addLine(`${parentVar}.appendChild(${elementVar});`);
    return elementVar;
  }

  private generateNodeCodeWithReturn(node: TemplateNode, parentVar: string): string {
    switch (node.type) {
      case 'element':
        return this.generateElementCode(node, parentVar);
      case 'text':
        return this.generateTextCodeWithReturn(node, parentVar);
      default:
        this.generateNodeCode(node);
        return '';
    }
  }

  private generateTextCodeWithReturn(node: TemplateNode, _parentVar: string): string {
    const textVar = `textNode_${Math.random().toString(36).substr(2, 9)}`;
    const text = (node.text || '').replace(/"/g, '\\"');
    this.addLine(`const ${textVar} = document.createTextNode("${text}");`);
    return textVar;
  }

  private generateTextCode(node: TemplateNode): void {
    if (node.text) {
      const textVar = `textNode_${Math.random().toString(36).substr(2, 9)}`;
      this.addLine(
        `const ${textVar} = document.createTextNode("${this.escapeString(node.text)}");`
      );
      this.addLine(`container.appendChild(${textVar});`);
    }
  }

  private generateDirectiveCode(_node: TemplateNode): void {
    // Directives are handled during element generation
    // This is a placeholder for standalone directive handling
  }

  private generateIslandCode(node: TemplateNode): void {
    if (node.island) {
      this.generateIslandWithProperty(node);
    } else if (node.tag === 'island') {
      this.generateIslandFromTag(node);
    }
  }

  private generateIslandWithProperty(node: TemplateNode): void {
    if (!node.island) return;

    this.islands.add(node.island.src);
    const islandVar = this.createIslandElement();
    this.addIslandAttributes(islandVar, node.island.src, node.island.strategy);
    this.generateIslandChildren(node, islandVar);
    this.addLine(`container.appendChild(${islandVar});`);

    // Generate code-split chunk for this island
    this.generateIslandChunk(node.island);
  }

  private generateIslandFromTag(node: TemplateNode): void {
    const islandVar = this.createIslandElement();

    // Extract src from attributes
    if (node.attributes?.src) {
      this.islands.add(node.attributes.src);
      this.addLine(`${islandVar}.setAttribute("data-src", "${node.attributes.src}");`);
    }

    // Extract strategy from attributes
    const strategy = this.extractIslandStrategy(node.attributes);
    if (strategy) {
      this.addLine(`${islandVar}.setAttribute("data-strategy", "${strategy}");`);
    }

    this.generateIslandChildren(node, islandVar);
    this.addLine(`container.appendChild(${islandVar});`);

    // Generate code-split chunk for this island
    if (node.attributes?.src && strategy) {
      const island: IslandNode = {
        src: node.attributes.src,
        strategy: strategy as IslandNode['strategy'],
      };
      this.generateIslandChunk(island);
    }
  }

  private createIslandElement(): string {
    return `island_${Math.random().toString(36).substr(2, 9)}`;
  }

  private addIslandAttributes(islandVar: string, src: string, strategy: string): void {
    this.addLine(`const ${islandVar} = document.createElement("div");`);
    this.addLine(`${islandVar}.setAttribute("data-island", "true");`);
    this.addLine(`${islandVar}.setAttribute("data-src", "${src}");`);
    this.addLine(`${islandVar}.setAttribute("data-strategy", "${strategy}");`);
  }

  private extractIslandStrategy(attributes?: Record<string, string>): string | null {
    if (!attributes) return null;

    for (const [name] of Object.entries(attributes)) {
      if (name.startsWith('client:')) {
        return name;
      }
    }
    return null;
  }

  private generateIslandChildren(node: TemplateNode, islandVar: string): void {
    if (node.children) {
      for (const child of node.children) {
        this.generateNodeCode(child);
        this.addLine(`${islandVar}.appendChild(child);`);
      }
    }
  }

  private generateScriptCode(node: TemplateNode): void {
    if (node.script) {
      if (this.options.target === 'server' && node.script.type === 'server') {
        // Server scripts are handled separately
        return;
      }
      if (this.options.target === 'client' && node.script.type === 'client') {
        this.addLine('// Client script:');
        this.addLine(node.script.content);
      }
    }
  }

  private generateDirectiveBinding(elementVar: string, name: string, value: string): void {
    // Strip curly braces from expression values
    const cleanValue = value.replace(/^{|}$/g, '').trim();

    if (name.startsWith('on:')) {
      this.generateEventDirective(elementVar, name, cleanValue);
    } else if (name.startsWith('bind:')) {
      this.generateBindDirective(elementVar, name, cleanValue);
    } else if (name.startsWith('class:')) {
      this.generateClassDirective(elementVar, name, cleanValue);
    } else if (name.startsWith('attr:')) {
      this.generateAttrDirective(elementVar, name, cleanValue);
    } else if (name === 'x:if') {
      this.generateIfDirective(elementVar, cleanValue);
    } else if (name === 'x:show') {
      this.generateShowDirective(elementVar, cleanValue);
    } else if (name === 'x:for' || name === 'x:key') {
      // x:for and x:key are handled at element level in generateForLoopElement
      return;
    } else if (name === 'use:action') {
      this.generateActionDirective(elementVar, cleanValue);
    } else if (name.startsWith('client:')) {
      // Island loading strategy - handled in island generation
      return;
    }
  }

  private generateEventDirective(elementVar: string, name: string, cleanValue: string): void {
    const eventName = name.slice(3);
    this.addLine(`${elementVar}.addEventListener("${eventName}", ${cleanValue});`);
  }

  private generateBindDirective(elementVar: string, name: string, cleanValue: string): void {
    const property = name.slice(5);
    this.addLine(`bindProperty(${elementVar}, "${property}", ${cleanValue});`);
  }

  private generateClassDirective(elementVar: string, name: string, cleanValue: string): void {
    const className = name.slice(6);
    this.addLine(`bindClass(${elementVar}, "${className}", ${cleanValue});`);
  }

  private generateAttrDirective(elementVar: string, name: string, cleanValue: string): void {
    const attrName = name.slice(5);
    this.addLine(`bindAttribute(${elementVar}, "${attrName}", ${cleanValue});`);
  }

  private generateIfDirective(elementVar: string, cleanValue: string): void {
    this.addLine(`if (${cleanValue}) {`);
    this.indentLevel++;
    this.addLine(`container.appendChild(${elementVar});`);
    this.indentLevel--;
    this.addLine('}');
  }

  private generateShowDirective(elementVar: string, cleanValue: string): void {
    this.addLine(`if (${cleanValue}) {`);
    this.indentLevel++;
    this.addLine(`${elementVar}.style.display = "block";`);
    this.indentLevel--;
    this.addLine('} else {');
    this.indentLevel++;
    this.addLine(`${elementVar}.style.display = "none";`);
    this.indentLevel--;
    this.addLine('}');
  }

  private generateActionDirective(elementVar: string, cleanValue: string): void {
    this.actions.add(cleanValue);
    this.addLine(`${elementVar}.setAttribute("data-action", "${cleanValue}");`);
  }

  private generateForLoopElement(node: TemplateNode, parentVar: string): string {
    // Parse x:for="item of items" syntax
    const forValue = node.attributes?.['x:for'];
    if (!forValue) return '';

    const cleanValue = forValue.replace(/^{|}$/g, '').trim();
    const match = cleanValue.match(/^(\w+)\s+of\s+(\w+)$/);
    if (!match) return '';

    const [, itemVar, itemsVar] = match;

    // Generate the loop
    this.addLine(`for (const ${itemVar} of ${itemsVar}) {`);
    this.indentLevel++;

    // Create element and generate its content
    this.generateForLoopElementContent(node, parentVar);

    this.indentLevel--;
    this.addLine('}');

    return '';
  }

  private generateForLoopElementContent(node: TemplateNode, parentVar: string): string {
    // Create element inside the loop (fresh for each iteration)
    const elementVar = `element_${Math.random().toString(36).substr(2, 9)}`;
    this.addLine(`const ${elementVar} = document.createElement("${node.tag}");`);

    // Generate attributes and key
    this.generateForLoopElementAttributes(node, elementVar);

    // Generate children inside the loop
    this.generateForLoopElementChildren(node, elementVar);

    // Append the element to parent
    this.addLine(`${parentVar}.appendChild(${elementVar});`);

    return elementVar;
  }

  private generateForLoopElementAttributes(node: TemplateNode, elementVar: string): void {
    const keyValue = node.attributes?.['x:key'];

    // Generate attributes (excluding x:for and x:key)
    if (node.attributes) {
      for (const [name, value] of Object.entries(node.attributes)) {
        if (name === 'x:for' || name === 'x:key') {
          continue; // Skip loop directives
        }
        if (this.isDirective(name)) {
          this.generateDirectiveBinding(elementVar, name, value);
        } else {
          this.addLine(`${elementVar}.setAttribute("${name}", "${value}");`);
        }
      }
    }

    // Add key attribute if present for efficient updates
    if (keyValue) {
      const cleanKeyValue = keyValue.replace(/^{|}$/g, '').trim();
      this.addLine(`${elementVar}.setAttribute("data-key", ${cleanKeyValue});`);
    }
  }

  private generateForLoopElementChildren(node: TemplateNode, elementVar: string): void {
    if (node.children) {
      for (const child of node.children) {
        const childVar = this.generateNodeCodeWithReturn(child, elementVar);
        if (childVar) {
          this.addLine(`${elementVar}.appendChild(${childVar});`);
        }
      }
    }
  }

  private generateHelpers(): void {
    this.code.push('');
    this.code.push('// Helper functions');
    this.code.push('function escapeString(str) {');
    this.code.push("  return str.replace(/\"/g, '\\\"').replace(/\\/g, '\\\\');");
    this.code.push('}');
  }

  private isDirective(name: string): boolean {
    return (
      name.startsWith('on:') ||
      name.startsWith('bind:') ||
      name.startsWith('class:') ||
      name.startsWith('attr:') ||
      name.startsWith('x:') ||
      name === 'use:action' ||
      name.startsWith('client:')
    );
  }

  private addLine(line: string): void {
    const indent = '  '.repeat(this.indentLevel);
    this.code.push(indent + line);
  }

  private escapeString(str: string): string {
    return str.replace(/"/g, '\\"').replace(/\\/g, '\\\\');
  }

  private generateIslandChunk(island: IslandNode): void {
    const chunkId = `island_${island.src.replace(/[^a-zA-Z0-9]/g, '_')}_${island.strategy}`;

    // Generate chunk code for the island
    const chunkCode = this.generateIslandChunkCode(island);

    // Create chunk entry
    const chunk: IslandChunk = {
      src: island.src,
      strategy: island.strategy,
      code: chunkCode,
      dependencies: [`@plank/runtime-dom`, `@plank/runtime-core`],
      id: chunkId,
    };

    this.chunks.push(chunk);
  }

  private generateIslandChunkCode(island: IslandNode): string {
    const lines: string[] = [];

    // Import runtime dependencies
    lines.push(`import { signal, computed, effect } from '@plank/runtime-core';`);
    lines.push(
      `import { bindText, bindAttribute, bindProperty, mountIsland } from '@plank/runtime-dom';`
    );

    // Generate island component code
    lines.push(
      `export function mount${island.src.replace(/[^a-zA-Z0-9]/g, '')}(element, props = {}) {`
    );
    lines.push(`  // Island component logic for ${island.src}`);
    lines.push(`  // This would be generated from the actual island template`);
    lines.push(`  console.log('Mounting island ${island.src} with strategy ${island.strategy}');`);
    lines.push(`  return {`);
    lines.push(`    unmount: () => console.log('Unmounting island ${island.src}')`);
    lines.push(`  };`);
    lines.push(`}`);

    return lines.join('\n');
  }
}

class DOMIRGenerator {
  private operations: DOMOperation[] = [];

  generate(ast: TemplateNode): DOMOperation[] {
    this.operations = [];
    this.generateNodeIR(ast);
    return this.operations;
  }

  private generateNodeIR(node: TemplateNode): void {
    switch (node.type) {
      case 'template':
        this.generateTemplateIR(node);
        break;
      case 'element':
        this.generateElementIR(node);
        break;
      case 'text':
        this.generateTextIR(node);
        break;
      case 'directive':
        this.generateDirectiveIR(node);
        break;
      case 'island':
        this.generateIslandIR(node);
        break;
      case 'script':
        this.generateScriptIR(node);
        break;
    }
  }

  private generateTemplateIR(node: TemplateNode): void {
    if (node.children) {
      for (const child of node.children) {
        this.generateNodeIR(child);
      }
    }
  }

  private generateElementIR(node: TemplateNode): void {
    const operation: DOMOperation = {
      type: 'createElement',
      tag: node.tag || 'div',
      attributes: node.attributes,
    };
    this.operations.push(operation);

    // Generate directive operations
    if (node.directive) {
      this.operations.push({
        type: 'createDirective',
        directive: node.directive,
      });
    }

    // Generate children
    if (node.children) {
      for (const child of node.children) {
        this.generateNodeIR(child);
        const lastOperation = this.operations[this.operations.length - 1];
        if (lastOperation) {
          this.operations.push({
            type: 'appendChild',
            child: lastOperation,
          });
        }
      }
    }
  }

  private generateTextIR(node: TemplateNode): void {
    if (node.text) {
      this.operations.push({
        type: 'createText',
        content: node.text,
      });
    }
  }

  private generateDirectiveIR(node: TemplateNode): void {
    if (node.directive) {
      this.operations.push({
        type: 'createDirective',
        directive: node.directive,
      });
    }
  }

  private generateIslandIR(node: TemplateNode): void {
    if (node.island) {
      this.operations.push({
        type: 'createIsland',
        src: node.island.src,
        strategy: node.island.strategy,
      });
    }
  }

  private generateScriptIR(node: TemplateNode): void {
    if (node.script) {
      this.operations.push({
        type: 'createScript',
        script: node.script,
      });
    }
  }
}
