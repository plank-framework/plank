/**
 * @fileoverview Plank template grammar definitions and AST types
 */

export interface TemplateNode {
  type: string;
  tag?: string;
  children?: TemplateNode[];
  attributes?: Record<string, string>;
  text?: string;
  directive?: DirectiveNode;
  island?: IslandNode;
  script?: ScriptNode;
}

export interface DirectiveNode {
  type:
    | 'on'
    | 'bind'
    | 'x-if'
    | 'x-else'
    | 'x-show'
    | 'x-for'
    | 'x-key'
    | 'class'
    | 'attr'
    | 'use-action'
    | 'unsafe-html';
  name: string;
  value: string;
  expression?: ExpressionNode;
}

export interface IslandNode {
  src: string;
  strategy: 'load' | 'idle' | 'visible' | 'interaction';
  fallback?: TemplateNode[];
}

export interface ScriptNode {
  type: 'server' | 'client';
  content: string;
  exports?: string[];
}

export interface ExpressionNode {
  type:
    | 'variable'
    | 'function'
    | 'operator'
    | 'literal'
    | 'conditional'
    | 'member'
    | 'property'
    | 'string'
    | 'boolean'
    | 'number';
  value?: string | number | boolean;
  object?: string;
  property?: string;
  name?: string;
  children?: ExpressionNode[];
}

export interface ForLoopNode {
  item: string;
  index?: string;
  list: ExpressionNode;
  key?: ExpressionNode;
}

// Directive patterns
export const DIRECTIVE_PATTERNS = {
  // Event handlers: on:click, on:submit, etc.
  EVENT:
    /^on:(click|submit|change|input|focus|blur|keydown|keyup|keypress|mousedown|mouseup|mouseover|mouseout|load|unload|resize|scroll)$/,

  // Two-way binding: bind:value, bind:checked, etc.
  BIND: /^bind:([a-zA-Z][a-zA-Z0-9-]*)$/,

  // Conditionals: x:if, x:else, x:show
  CONDITIONAL: /^x:(if|else|show)$/,

  // Loops: x:for, x:key
  LOOP: /^x:(for|key)$/,

  // Dynamic classes: class:active, class:btn-primary
  CLASS: /^class:([a-zA-Z][a-zA-Z0-9-]*)$/,

  // Dynamic attributes: attr:data-id, attr:aria-label
  ATTR: /^attr:([a-zA-Z][a-zA-Z0-9-]*)$/,

  // Server actions: use:action
  ACTION: /^use:action$/,

  // Unsafe HTML: unsafe:html
  UNSAFE: /^unsafe:html$/,
} as const;

// Island strategies
export const ISLAND_STRATEGIES = {
  'client:load': 'load',
  'client:idle': 'idle',
  'client:visible': 'visible',
  'client:interaction': 'interaction',
} as const;

// Expression operators
export const EXPRESSION_OPERATORS = [
  '&&',
  '||',
  '??', // Logical
  '===',
  '!==',
  '==',
  '!=', // Equality
  '<',
  '>',
  '<=',
  '>=', // Comparison
  '+',
  '-',
  '*',
  '/',
  '%', // Arithmetic
  '?',
  ':', // Conditional
] as const;

// Reserved keywords
export const RESERVED_KEYWORDS = [
  'true',
  'false',
  'null',
  'undefined',
  'if',
  'else',
  'for',
  'while',
  'function',
  'return',
  'break',
  'continue',
  'var',
  'let',
  'const',
  'import',
  'export',
  'from',
  'as',
  'default',
] as const;

// Template syntax validation
export function isValidDirective(name: string): boolean {
  return Object.values(DIRECTIVE_PATTERNS).some((pattern) => pattern.test(name));
}

export function getDirectiveType(name: string): DirectiveNode['type'] | null {
  if (DIRECTIVE_PATTERNS.EVENT.test(name)) return 'on';
  if (DIRECTIVE_PATTERNS.BIND.test(name)) return 'bind';
  if (DIRECTIVE_PATTERNS.CONDITIONAL.test(name)) return 'x-if';
  if (DIRECTIVE_PATTERNS.LOOP.test(name)) return 'x-for';
  if (DIRECTIVE_PATTERNS.CLASS.test(name)) return 'class';
  if (DIRECTIVE_PATTERNS.ATTR.test(name)) return 'attr';
  if (DIRECTIVE_PATTERNS.ACTION.test(name)) return 'use-action';
  if (DIRECTIVE_PATTERNS.UNSAFE.test(name)) return 'unsafe-html';
  return null;
}

export function isValidIslandStrategy(
  strategy: string
): strategy is keyof typeof ISLAND_STRATEGIES {
  return strategy in ISLAND_STRATEGIES;
}

function areBracketsBalanced(expression: string): boolean {
  const stack: string[] = [];
  const pairs: Record<string, string> = { ')': '(', ']': '[', '}': '{' };

  for (const char of expression) {
    if (['(', '[', '{'].includes(char)) {
      stack.push(char);
    } else if (char in pairs) {
      if (stack.length === 0 || stack.pop() !== pairs[char]) {
        return false;
      }
    }
  }
  return stack.length === 0;
}

export function isValidExpression(expression: string): boolean {
  try {
    return areBracketsBalanced(expression);
  } catch {
    return false;
  }
}
