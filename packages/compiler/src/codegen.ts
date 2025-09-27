/**
 * @fileoverview Code generation for Plank templates
 * Converts AST to JavaScript code for server and client
 */

import type { DirectiveNode, ScriptNode, TemplateNode } from './grammar.js';
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
  | { type: 'createIsland'; src: string; strategy: string; props?: Record<string, unknown> | undefined }
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
    };
  }

  private reset(): void {
    this.imports.clear();
    this.islands.clear();
    this.actions.clear();
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
        this.generateElementCode(node);
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

  private generateElementCode(node: TemplateNode): void {
    // Check if this is an island element
    if (node.tag === 'island') {
      this.generateIslandCode(node);
      return;
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
        this.generateNodeCode(child);
        this.addLine(`${elementVar}.appendChild(child);`);
      }
    }

    this.addLine(`container.appendChild(${elementVar});`);
  }

  private generateTextCode(node: TemplateNode): void {
    if (node.text) {
      const textVar = `textNode_${Math.random().toString(36).substr(2, 9)}`;
      this.addLine(`const ${textVar} = document.createTextNode("${this.escapeString(node.text)}");`);
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
    if (name.startsWith('on:')) {
      const eventName = name.slice(3);
      this.addLine(`${elementVar}.addEventListener("${eventName}", ${value});`);
    } else if (name.startsWith('bind:')) {
      const property = name.slice(5);
      this.addLine(`bindProperty(${elementVar}, "${property}", ${value});`);
    } else if (name.startsWith('class:')) {
      const className = name.slice(6);
      this.addLine(`bindClass(${elementVar}, "${className}", ${value});`);
    } else if (name.startsWith('attr:')) {
      const attrName = name.slice(5);
      this.addLine(`bindAttribute(${elementVar}, "${attrName}", ${value});`);
    } else if (name === 'x:if') {
      this.addLine(`if (${value}) {`);
      this.indentLevel++;
      this.addLine(`container.appendChild(${elementVar});`);
      this.indentLevel--;
      this.addLine('}');
    } else if (name === 'x:show') {
      this.addLine(`if (${value}) {`);
      this.indentLevel++;
      this.addLine(`${elementVar}.style.display = "block";`);
      this.indentLevel--;
      this.addLine('} else {');
      this.indentLevel++;
      this.addLine(`${elementVar}.style.display = "none";`);
      this.indentLevel--;
      this.addLine('}');
    } else if (name === 'x:for') {
      this.generateForLoop(elementVar, value);
    } else if (name === 'use:action') {
      // Extract action name from value (remove curly braces if present)
      const actionName = value.replace(/[{}]/g, '');
      this.actions.add(actionName);
      this.addLine(`${elementVar}.setAttribute("data-action", "${actionName}");`);
    } else if (name.startsWith('client:')) {
      // Island loading strategy - handled in island generation
      return;
    }
  }

  private generateForLoop(elementVar: string, value: string): void {
    // Parse x:for="item of items" syntax
    const match = value.match(/^(\w+)\s+of\s+(\w+)$/);
    if (match) {
      const [, itemVar, itemsVar] = match;
      this.addLine(`for (const ${itemVar} of ${itemsVar}) {`);
      this.indentLevel++;
      this.addLine(`container.appendChild(${elementVar});`);
      this.indentLevel--;
      this.addLine('}');
    }
  }

  private generateHelpers(): void {
    this.code.push('');
    this.code.push('// Helper functions');
    this.code.push('function escapeString(str) {');
    this.code.push('  return str.replace(/"/g, \'\\"\').replace(/\\/g, \'\\\\\');');
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
