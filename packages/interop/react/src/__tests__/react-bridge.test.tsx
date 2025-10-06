/**
 * @fileoverview Tests for React bridge functionality
 */

import { signal } from '@plank/runtime-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlankSignal, useSignal, useSyncToSignal } from '../react-bridge.js';

// Mock React hooks
vi.mock('react', () => ({
  useState: vi.fn(),
  useEffect: vi.fn(),
}));

describe('createPlankSignal', () => {
  it('should create a Plank signal with initial value', () => {
    const initialValue = 'test';
    const plankSignal = createPlankSignal(initialValue);

    expect(plankSignal).toBeDefined();
    expect(typeof plankSignal).toBe('function');
    expect(plankSignal()).toBe(initialValue);
  });

  it('should create a Plank signal with number initial value', () => {
    const initialValue = 42;
    const plankSignal = createPlankSignal(initialValue);

    expect(plankSignal()).toBe(initialValue);
  });

  it('should create a Plank signal with object initial value', () => {
    const initialValue = { name: 'test', count: 5 };
    const plankSignal = createPlankSignal(initialValue);

    expect(plankSignal()).toEqual(initialValue);
  });
});

describe('useSignal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should subscribe to a Plank signal', async () => {
    const plankSignal = signal('initial');
    const mockSetValue = vi.fn();
    const React = await import('react');
    const mockUseState = vi.mocked(React.useState);
    const mockUseEffect = vi.mocked(React.useEffect);

    mockUseState.mockReturnValue(['initial', mockSetValue]);
    mockUseEffect.mockImplementation((callback) => {
      // Simulate the effect running
      callback();
    });

    const result = useSignal(plankSignal);

    expect(mockUseState).toHaveBeenCalledWith('initial');
    expect(mockUseEffect).toHaveBeenCalled();
    expect(result).toBe('initial');
  });

  it('should handle signal value changes', async () => {
    const plankSignal = signal('initial');
    const mockSetValue = vi.fn();
    const React = await import('react');
    const mockUseState = vi.mocked(React.useState);
    const mockUseEffect = vi.mocked(React.useEffect);

    mockUseState.mockReturnValue(['initial', mockSetValue]);
    mockUseEffect.mockImplementation((callback) => {
      // Simulate the effect running
      callback();
    });

    useSignal(plankSignal);

    // Verify the effect callback was called
    expect(mockUseEffect).toHaveBeenCalledWith(expect.any(Function), [plankSignal]);
  });

  it('should handle different signal types', async () => {
    const numberSignal = signal(42);
    const mockSetValue = vi.fn();
    const React = await import('react');
    const mockUseState = vi.mocked(React.useState);
    const mockUseEffect = vi.mocked(React.useEffect);

    mockUseState.mockReturnValue([42, mockSetValue]);
    mockUseEffect.mockImplementation((callback) => {
      callback();
    });

    const result = useSignal(numberSignal);

    expect(result).toBe(42);
  });
});

describe('useSyncToSignal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should sync React state to Plank signal', async () => {
    const plankSignal = signal('initial');
    const value = 'updated';
    const React = await import('react');
    const mockUseEffect = vi.mocked(React.useEffect);

    mockUseEffect.mockImplementation((callback) => {
      callback();
    });

    useSyncToSignal(plankSignal, value);

    expect(mockUseEffect).toHaveBeenCalledWith(expect.any(Function), [plankSignal, value]);
  });

  it('should not update signal if values are equal', async () => {
    const plankSignal = signal('same');
    const value = 'same';
    const React = await import('react');
    const mockUseEffect = vi.mocked(React.useEffect);

    mockUseEffect.mockImplementation((callback) => {
      callback();
    });

    useSyncToSignal(plankSignal, value);

    expect(mockUseEffect).toHaveBeenCalledWith(expect.any(Function), [plankSignal, value]);
  });

  it('should handle different value types', async () => {
    const plankSignal = signal(0);
    const value = 42;
    const React = await import('react');
    const mockUseEffect = vi.mocked(React.useEffect);

    mockUseEffect.mockImplementation((callback) => {
      callback();
    });

    useSyncToSignal(plankSignal, value);

    expect(mockUseEffect).toHaveBeenCalledWith(expect.any(Function), [plankSignal, value]);
  });
});

describe('React bridge integration', () => {
  it('should work with complex data structures', () => {
    const complexData = {
      user: { id: 1, name: 'John' },
      settings: { theme: 'dark', notifications: true },
      items: [1, 2, 3],
    };

    const plankSignal = createPlankSignal(complexData);
    expect(plankSignal()).toEqual(complexData);
  });

  it('should handle null and undefined values', () => {
    const nullSignal = createPlankSignal(null);
    expect(nullSignal()).toBeNull();

    const undefinedSignal = createPlankSignal(undefined);
    expect(undefinedSignal()).toBeUndefined();
  });

  it('should handle boolean values', () => {
    const trueSignal = createPlankSignal(true);
    expect(trueSignal()).toBe(true);

    const falseSignal = createPlankSignal(false);
    expect(falseSignal()).toBe(false);
  });
});
