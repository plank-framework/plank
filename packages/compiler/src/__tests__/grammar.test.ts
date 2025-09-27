/**
 * @fileoverview Tests for Plank template grammar definitions and validation
 */

import { describe, expect, test } from 'vitest';
import {
  DIRECTIVE_PATTERNS,
  EXPRESSION_OPERATORS,
  getDirectiveType,
  ISLAND_STRATEGIES,
  isValidDirective,
  isValidExpression,
  isValidIslandStrategy,
  RESERVED_KEYWORDS,
} from '../grammar.js';

describe('Plank Grammar', () => {
  describe('Directive Patterns', () => {
    test('should match event directives', () => {
      expect(DIRECTIVE_PATTERNS.EVENT.test('on:click')).toBe(true);
      expect(DIRECTIVE_PATTERNS.EVENT.test('on:submit')).toBe(true);
      expect(DIRECTIVE_PATTERNS.EVENT.test('on:change')).toBe(true);
      expect(DIRECTIVE_PATTERNS.EVENT.test('on:input')).toBe(true);
      expect(DIRECTIVE_PATTERNS.EVENT.test('on:focus')).toBe(true);
      expect(DIRECTIVE_PATTERNS.EVENT.test('on:blur')).toBe(true);
      expect(DIRECTIVE_PATTERNS.EVENT.test('on:keydown')).toBe(true);
      expect(DIRECTIVE_PATTERNS.EVENT.test('on:keyup')).toBe(true);
      expect(DIRECTIVE_PATTERNS.EVENT.test('on:keypress')).toBe(true);
      expect(DIRECTIVE_PATTERNS.EVENT.test('on:mousedown')).toBe(true);
      expect(DIRECTIVE_PATTERNS.EVENT.test('on:mouseup')).toBe(true);
      expect(DIRECTIVE_PATTERNS.EVENT.test('on:mouseover')).toBe(true);
      expect(DIRECTIVE_PATTERNS.EVENT.test('on:mouseout')).toBe(true);
      expect(DIRECTIVE_PATTERNS.EVENT.test('on:load')).toBe(true);
      expect(DIRECTIVE_PATTERNS.EVENT.test('on:unload')).toBe(true);
      expect(DIRECTIVE_PATTERNS.EVENT.test('on:resize')).toBe(true);
      expect(DIRECTIVE_PATTERNS.EVENT.test('on:scroll')).toBe(true);
    });

    test('should not match invalid event directives', () => {
      expect(DIRECTIVE_PATTERNS.EVENT.test('on:invalid')).toBe(false);
      expect(DIRECTIVE_PATTERNS.EVENT.test('on:')).toBe(false);
      expect(DIRECTIVE_PATTERNS.EVENT.test('on')).toBe(false);
      expect(DIRECTIVE_PATTERNS.EVENT.test('click')).toBe(false);
    });

    test('should match bind directives', () => {
      expect(DIRECTIVE_PATTERNS.BIND.test('bind:value')).toBe(true);
      expect(DIRECTIVE_PATTERNS.BIND.test('bind:checked')).toBe(true);
      expect(DIRECTIVE_PATTERNS.BIND.test('bind:disabled')).toBe(true);
      expect(DIRECTIVE_PATTERNS.BIND.test('bind:class')).toBe(true);
      expect(DIRECTIVE_PATTERNS.BIND.test('bind:style')).toBe(true);
    });

    test('should not match invalid bind directives', () => {
      expect(DIRECTIVE_PATTERNS.BIND.test('bind:')).toBe(false);
      expect(DIRECTIVE_PATTERNS.BIND.test('bind')).toBe(false);
      expect(DIRECTIVE_PATTERNS.BIND.test('bind:123')).toBe(false);
      expect(DIRECTIVE_PATTERNS.BIND.test('bind:-invalid')).toBe(false);
    });

    test('should match conditional directives', () => {
      expect(DIRECTIVE_PATTERNS.CONDITIONAL.test('x:if')).toBe(true);
      expect(DIRECTIVE_PATTERNS.CONDITIONAL.test('x:else')).toBe(true);
      expect(DIRECTIVE_PATTERNS.CONDITIONAL.test('x:show')).toBe(true);
    });

    test('should not match invalid conditional directives', () => {
      expect(DIRECTIVE_PATTERNS.CONDITIONAL.test('x:')).toBe(false);
      expect(DIRECTIVE_PATTERNS.CONDITIONAL.test('x')).toBe(false);
      expect(DIRECTIVE_PATTERNS.CONDITIONAL.test('x:invalid')).toBe(false);
    });

    test('should match loop directives', () => {
      expect(DIRECTIVE_PATTERNS.LOOP.test('x:for')).toBe(true);
      expect(DIRECTIVE_PATTERNS.LOOP.test('x:key')).toBe(true);
    });

    test('should not match invalid loop directives', () => {
      expect(DIRECTIVE_PATTERNS.LOOP.test('x:')).toBe(false);
      expect(DIRECTIVE_PATTERNS.LOOP.test('x')).toBe(false);
      expect(DIRECTIVE_PATTERNS.LOOP.test('x:invalid')).toBe(false);
    });

    test('should match class directives', () => {
      expect(DIRECTIVE_PATTERNS.CLASS.test('class:active')).toBe(true);
      expect(DIRECTIVE_PATTERNS.CLASS.test('class:btn-primary')).toBe(true);
      expect(DIRECTIVE_PATTERNS.CLASS.test('class:disabled')).toBe(true);
    });

    test('should not match invalid class directives', () => {
      expect(DIRECTIVE_PATTERNS.CLASS.test('class:')).toBe(false);
      expect(DIRECTIVE_PATTERNS.CLASS.test('class')).toBe(false);
      expect(DIRECTIVE_PATTERNS.CLASS.test('class:123')).toBe(false);
      expect(DIRECTIVE_PATTERNS.CLASS.test('class:-invalid')).toBe(false);
    });

    test('should match attr directives', () => {
      expect(DIRECTIVE_PATTERNS.ATTR.test('attr:data-id')).toBe(true);
      expect(DIRECTIVE_PATTERNS.ATTR.test('attr:aria-label')).toBe(true);
      expect(DIRECTIVE_PATTERNS.ATTR.test('attr:title')).toBe(true);
    });

    test('should not match invalid attr directives', () => {
      expect(DIRECTIVE_PATTERNS.ATTR.test('attr:')).toBe(false);
      expect(DIRECTIVE_PATTERNS.ATTR.test('attr')).toBe(false);
      expect(DIRECTIVE_PATTERNS.ATTR.test('attr:123')).toBe(false);
      expect(DIRECTIVE_PATTERNS.ATTR.test('attr:-invalid')).toBe(false);
    });

    test('should match action directives', () => {
      expect(DIRECTIVE_PATTERNS.ACTION.test('use:action')).toBe(true);
    });

    test('should not match invalid action directives', () => {
      expect(DIRECTIVE_PATTERNS.ACTION.test('use:')).toBe(false);
      expect(DIRECTIVE_PATTERNS.ACTION.test('use')).toBe(false);
      expect(DIRECTIVE_PATTERNS.ACTION.test('use:invalid')).toBe(false);
    });

    test('should match unsafe directives', () => {
      expect(DIRECTIVE_PATTERNS.UNSAFE.test('unsafe:html')).toBe(true);
    });

    test('should not match invalid unsafe directives', () => {
      expect(DIRECTIVE_PATTERNS.UNSAFE.test('unsafe:')).toBe(false);
      expect(DIRECTIVE_PATTERNS.UNSAFE.test('unsafe')).toBe(false);
      expect(DIRECTIVE_PATTERNS.UNSAFE.test('unsafe:invalid')).toBe(false);
    });
  });

  describe('Island Strategies', () => {
    test('should contain all expected strategies', () => {
      expect(ISLAND_STRATEGIES).toEqual({
        'client:load': 'load',
        'client:idle': 'idle',
        'client:visible': 'visible',
        'client:interaction': 'interaction',
      });
    });
  });

  describe('Expression Operators', () => {
    test('should contain all expected operators', () => {
      expect(EXPRESSION_OPERATORS).toContain('&&');
      expect(EXPRESSION_OPERATORS).toContain('||');
      expect(EXPRESSION_OPERATORS).toContain('??');
      expect(EXPRESSION_OPERATORS).toContain('===');
      expect(EXPRESSION_OPERATORS).toContain('!==');
      expect(EXPRESSION_OPERATORS).toContain('==');
      expect(EXPRESSION_OPERATORS).toContain('!=');
      expect(EXPRESSION_OPERATORS).toContain('<');
      expect(EXPRESSION_OPERATORS).toContain('>');
      expect(EXPRESSION_OPERATORS).toContain('<=');
      expect(EXPRESSION_OPERATORS).toContain('>=');
      expect(EXPRESSION_OPERATORS).toContain('+');
      expect(EXPRESSION_OPERATORS).toContain('-');
      expect(EXPRESSION_OPERATORS).toContain('*');
      expect(EXPRESSION_OPERATORS).toContain('/');
      expect(EXPRESSION_OPERATORS).toContain('%');
      expect(EXPRESSION_OPERATORS).toContain('?');
      expect(EXPRESSION_OPERATORS).toContain(':');
    });
  });

  describe('Reserved Keywords', () => {
    test('should contain all expected keywords', () => {
      expect(RESERVED_KEYWORDS).toContain('true');
      expect(RESERVED_KEYWORDS).toContain('false');
      expect(RESERVED_KEYWORDS).toContain('null');
      expect(RESERVED_KEYWORDS).toContain('undefined');
      expect(RESERVED_KEYWORDS).toContain('if');
      expect(RESERVED_KEYWORDS).toContain('else');
      expect(RESERVED_KEYWORDS).toContain('for');
      expect(RESERVED_KEYWORDS).toContain('while');
      expect(RESERVED_KEYWORDS).toContain('function');
      expect(RESERVED_KEYWORDS).toContain('return');
      expect(RESERVED_KEYWORDS).toContain('break');
      expect(RESERVED_KEYWORDS).toContain('continue');
      expect(RESERVED_KEYWORDS).toContain('var');
      expect(RESERVED_KEYWORDS).toContain('let');
      expect(RESERVED_KEYWORDS).toContain('const');
      expect(RESERVED_KEYWORDS).toContain('import');
      expect(RESERVED_KEYWORDS).toContain('export');
      expect(RESERVED_KEYWORDS).toContain('from');
      expect(RESERVED_KEYWORDS).toContain('as');
      expect(RESERVED_KEYWORDS).toContain('default');
    });
  });

  describe('isValidDirective', () => {
    test('should validate event directives', () => {
      expect(isValidDirective('on:click')).toBe(true);
      expect(isValidDirective('on:submit')).toBe(true);
      expect(isValidDirective('on:change')).toBe(true);
    });

    test('should validate bind directives', () => {
      expect(isValidDirective('bind:value')).toBe(true);
      expect(isValidDirective('bind:checked')).toBe(true);
    });

    test('should validate conditional directives', () => {
      expect(isValidDirective('x:if')).toBe(true);
      expect(isValidDirective('x:else')).toBe(true);
      expect(isValidDirective('x:show')).toBe(true);
    });

    test('should validate loop directives', () => {
      expect(isValidDirective('x:for')).toBe(true);
      expect(isValidDirective('x:key')).toBe(true);
    });

    test('should validate class directives', () => {
      expect(isValidDirective('class:active')).toBe(true);
      expect(isValidDirective('class:btn-primary')).toBe(true);
    });

    test('should validate attr directives', () => {
      expect(isValidDirective('attr:data-id')).toBe(true);
      expect(isValidDirective('attr:aria-label')).toBe(true);
    });

    test('should validate action directives', () => {
      expect(isValidDirective('use:action')).toBe(true);
    });

    test('should validate unsafe directives', () => {
      expect(isValidDirective('unsafe:html')).toBe(true);
    });

    test('should reject invalid directives', () => {
      expect(isValidDirective('invalid:directive')).toBe(false);
      expect(isValidDirective('on:invalid')).toBe(false);
      expect(isValidDirective('bind:')).toBe(false);
      expect(isValidDirective('x:invalid')).toBe(false);
      expect(isValidDirective('class:123')).toBe(false);
      expect(isValidDirective('attr:-invalid')).toBe(false);
      expect(isValidDirective('use:invalid')).toBe(false);
      expect(isValidDirective('unsafe:invalid')).toBe(false);
    });
  });

  describe('getDirectiveType', () => {
    test('should return correct type for event directives', () => {
      expect(getDirectiveType('on:click')).toBe('on');
      expect(getDirectiveType('on:submit')).toBe('on');
      expect(getDirectiveType('on:change')).toBe('on');
    });

    test('should return correct type for bind directives', () => {
      expect(getDirectiveType('bind:value')).toBe('bind');
      expect(getDirectiveType('bind:checked')).toBe('bind');
    });

    test('should return correct type for conditional directives', () => {
      expect(getDirectiveType('x:if')).toBe('x-if');
      expect(getDirectiveType('x:else')).toBe('x-if');
      expect(getDirectiveType('x:show')).toBe('x-if');
    });

    test('should return correct type for loop directives', () => {
      expect(getDirectiveType('x:for')).toBe('x-for');
      expect(getDirectiveType('x:key')).toBe('x-for');
    });

    test('should return correct type for class directives', () => {
      expect(getDirectiveType('class:active')).toBe('class');
      expect(getDirectiveType('class:btn-primary')).toBe('class');
    });

    test('should return correct type for attr directives', () => {
      expect(getDirectiveType('attr:data-id')).toBe('attr');
      expect(getDirectiveType('attr:aria-label')).toBe('attr');
    });

    test('should return correct type for action directives', () => {
      expect(getDirectiveType('use:action')).toBe('use-action');
    });

    test('should return correct type for unsafe directives', () => {
      expect(getDirectiveType('unsafe:html')).toBe('unsafe-html');
    });

    test('should return null for invalid directives', () => {
      expect(getDirectiveType('invalid:directive')).toBe(null);
      expect(getDirectiveType('on:invalid')).toBe(null);
      expect(getDirectiveType('bind:')).toBe(null);
      expect(getDirectiveType('x:invalid')).toBe(null);
      expect(getDirectiveType('class:123')).toBe(null);
      expect(getDirectiveType('attr:-invalid')).toBe(null);
      expect(getDirectiveType('use:invalid')).toBe(null);
      expect(getDirectiveType('unsafe:invalid')).toBe(null);
    });
  });

  describe('isValidIslandStrategy', () => {
    test('should validate valid island strategies', () => {
      expect(isValidIslandStrategy('client:load')).toBe(true);
      expect(isValidIslandStrategy('client:idle')).toBe(true);
      expect(isValidIslandStrategy('client:visible')).toBe(true);
      expect(isValidIslandStrategy('client:interaction')).toBe(true);
    });

    test('should reject invalid island strategies', () => {
      expect(isValidIslandStrategy('client:invalid')).toBe(false);
      expect(isValidIslandStrategy('server:load')).toBe(false);
      expect(isValidIslandStrategy('load')).toBe(false);
      expect(isValidIslandStrategy('')).toBe(false);
    });
  });

  describe('isValidExpression', () => {
    test('should validate balanced brackets', () => {
      expect(isValidExpression('{value}')).toBe(true);
      expect(isValidExpression('{user.name}')).toBe(true);
      expect(isValidExpression('{items[index]}')).toBe(true);
      expect(isValidExpression('{func(arg1, arg2)}')).toBe(true);
      expect(isValidExpression('{obj.prop.method()}')).toBe(true);
      expect(isValidExpression('{(a + b) * c}')).toBe(true);
      expect(isValidExpression('{[1, 2, 3].map(x => x * 2)}')).toBe(true);
    });

    test('should reject unbalanced brackets', () => {
      expect(isValidExpression('{value')).toBe(false);
      expect(isValidExpression('value}')).toBe(false);
      expect(isValidExpression('{user.name')).toBe(false);
      expect(isValidExpression('user.name}')).toBe(false);
      expect(isValidExpression('{items[index}')).toBe(false);
      expect(isValidExpression('{func(arg1, arg2}')).toBe(false);
      expect(isValidExpression('{obj.prop.method(}')).toBe(false);
      expect(isValidExpression('{(a + b * c}')).toBe(false);
      expect(isValidExpression('{[1, 2, 3].map(x => x * 2}')).toBe(false);
    });

    test('should handle nested brackets', () => {
      expect(isValidExpression('{obj[items[index]]}')).toBe(true);
      expect(isValidExpression('{func(arg1, {nested: value})}')).toBe(true);
      expect(isValidExpression('{arr.map(x => ({id: x}))}')).toBe(true);
    });

    test('should reject mismatched brackets', () => {
      expect(isValidExpression('{obj[items(index]]}')).toBe(false);
      expect(isValidExpression('{func(arg1, {nested: value})}')).toBe(true);
      expect(isValidExpression('{arr.map(x => [id: x])}')).toBe(true); // This is actually valid - balanced brackets
    });

    test('should handle empty expressions', () => {
      expect(isValidExpression('{}')).toBe(true);
      expect(isValidExpression('')).toBe(true);
    });

    test('should handle complex expressions', () => {
      expect(isValidExpression('{a && b || c}')).toBe(true);
      expect(isValidExpression('{a ? b : c}')).toBe(true);
      expect(isValidExpression('{a ?? b}')).toBe(true);
      expect(isValidExpression('{a === b}')).toBe(true);
      expect(isValidExpression('{a !== b}')).toBe(true);
      expect(isValidExpression('{a < b && c > d}')).toBe(true);
      expect(isValidExpression('{a + b * c / d}')).toBe(true);
    });
  });
});
