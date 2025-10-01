/**
 * @fileoverview Tests for "what ships" report generator
 */

import { describe, expect, it } from 'vitest';
import type { BudgetReport } from '../../commands/analyze.js';
import { generateWhatShipsReport } from '../what-ships.js';

describe('generateWhatShipsReport', () => {
  it('should generate report for routes with zero JS', () => {
    const report: BudgetReport = {
      routes: [
        {
          path: '/',
          jsBytes: 0,
          jsBytesRaw: 0,
          budget: 10240,
          budgetType: 'marketing',
          status: 'pass',
          breakdown: { runtime: 0, islands: 0, vendor: 0, app: 0 },
          recommendations: ['✅ Perfect! This route ships zero JavaScript'],
        },
      ],
      summary: {
        totalRoutes: 1,
        passingRoutes: 1,
        failingRoutes: 0,
        totalJS: 0,
        averageJS: 0,
      },
      budgets: {
        marketing: 10240,
        app: 35840,
        static: 0,
      },
    };

    const result = generateWhatShipsReport(report);

    expect(result).toContain('WHAT SHIPS TO PRODUCTION');
    expect(result).toContain('✅');
    expect(result).toContain('/');
    expect(result).toContain('0 KB');
    expect(result).toContain('1 routes ship ZERO JavaScript');
  });

  it('should generate report for routes with JS', () => {
    const report: BudgetReport = {
      routes: [
        {
          path: '/dashboard',
          jsBytes: 25600,
          jsBytesRaw: 102400,
          budget: 35840,
          budgetType: 'app',
          status: 'pass',
          breakdown: { runtime: 10240, islands: 8192, vendor: 5120, app: 2048 },
          recommendations: [],
        },
      ],
      summary: {
        totalRoutes: 1,
        passingRoutes: 1,
        failingRoutes: 0,
        totalJS: 25600,
        averageJS: 25600,
      },
      budgets: {
        marketing: 10240,
        app: 35840,
        static: 0,
      },
    };

    const result = generateWhatShipsReport(report);

    expect(result).toContain('WHAT SHIPS TO PRODUCTION');
    expect(result).toContain('/dashboard');
    expect(result).toContain('APP ROUTES');
    expect(result).toContain('Breakdown');
    expect(result).toContain('Runtime');
    expect(result).toContain('Islands');
  });

  it('should show progress bars', () => {
    const report: BudgetReport = {
      routes: [
        {
          path: '/',
          jsBytes: 5120, // 50% of budget
          jsBytesRaw: 20480,
          budget: 10240,
          budgetType: 'marketing',
          status: 'pass',
          breakdown: { runtime: 5120, islands: 0, vendor: 0, app: 0 },
          recommendations: [],
        },
      ],
      summary: {
        totalRoutes: 1,
        passingRoutes: 1,
        failingRoutes: 0,
        totalJS: 5120,
        averageJS: 5120,
      },
      budgets: {
        marketing: 10240,
        app: 35840,
        static: 0,
      },
    };

    const result = generateWhatShipsReport(report);

    // Should contain progress bar characters
    expect(result).toMatch(/[█░]/);
    expect(result).toContain('🟢'); // Green for under 70%
  });

  it('should group routes by type', () => {
    const report: BudgetReport = {
      routes: [
        {
          path: '/',
          jsBytes: 0,
          jsBytesRaw: 0,
          budget: 10240,
          budgetType: 'marketing',
          status: 'pass',
          breakdown: { runtime: 0, islands: 0, vendor: 0, app: 0 },
          recommendations: [],
        },
        {
          path: '/dashboard',
          jsBytes: 20480,
          jsBytesRaw: 81920,
          budget: 35840,
          budgetType: 'app',
          status: 'pass',
          breakdown: { runtime: 20480, islands: 0, vendor: 0, app: 0 },
          recommendations: [],
        },
      ],
      summary: {
        totalRoutes: 2,
        passingRoutes: 2,
        failingRoutes: 0,
        totalJS: 20480,
        averageJS: 10240,
      },
      budgets: {
        marketing: 10240,
        app: 35840,
        static: 0,
      },
    };

    const result = generateWhatShipsReport(report);

    expect(result).toContain('MARKETING ROUTES');
    expect(result).toContain('APP ROUTES');
  });

  it('should highlight failing routes', () => {
    const report: BudgetReport = {
      routes: [
        {
          path: '/heavy',
          jsBytes: 40960, // Over 35KB budget
          jsBytesRaw: 163840,
          budget: 35840,
          budgetType: 'app',
          status: 'fail',
          breakdown: { runtime: 10240, islands: 15360, vendor: 10240, app: 5120 },
          recommendations: ['⚠️  Bundle exceeds budget'],
        },
      ],
      summary: {
        totalRoutes: 1,
        passingRoutes: 0,
        failingRoutes: 1,
        totalJS: 40960,
        averageJS: 40960,
      },
      budgets: {
        marketing: 10240,
        app: 35840,
        static: 0,
      },
    };

    const result = generateWhatShipsReport(report);

    expect(result).toContain('❌');
    expect(result).toContain('🔴'); // Red progress bar
    expect(result).toContain('Exceeding:     1');
  });
});
