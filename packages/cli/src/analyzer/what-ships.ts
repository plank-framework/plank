/**
 * @fileoverview "What Ships" report generator
 * Visual breakdown of what JavaScript actually ships to production
 */

import type { BudgetReport, RouteAnalysis } from '../commands/analyze.js';

/**
 * Generate "What Ships" report
 */
export function generateWhatShipsReport(report: BudgetReport): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  lines.push('┃  📦 WHAT SHIPS TO PRODUCTION                           ┃');
  lines.push('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  lines.push('');

  // Group routes by budget type
  const byType = groupRoutesByType(report.routes);

  for (const [type, routes] of Object.entries(byType)) {
    if (routes.length === 0) continue;

    lines.push(`📍 ${type.toUpperCase()} ROUTES (${routes.length}):`);
    lines.push('');

    for (const route of routes) {
      const icon = route.status === 'pass' ? '✅' : '❌';
      const bar = createProgressBar(route.jsBytes, route.budget);

      lines.push(`  ${icon} ${route.path}`);
      lines.push(`     ${bar}`);
      lines.push(
        `     ${formatBytes(route.jsBytes)} / ${formatBytes(route.budget)} (${getPercentage(route.jsBytes, route.budget)}%)`
      );

      if (route.jsBytes > 0) {
        lines.push(
          `     Breakdown: Runtime ${formatBytes(route.breakdown.runtime)} | Islands ${formatBytes(route.breakdown.islands)} | Vendor ${formatBytes(route.breakdown.vendor)} | App ${formatBytes(route.breakdown.app)}`
        );
      }

      lines.push('');
    }
  }

  // Summary
  lines.push('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓');
  lines.push('┃  📊 SUMMARY                                           ┃');
  lines.push('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛');
  lines.push('');
  lines.push(`  Total Routes:     ${report.summary.totalRoutes}`);
  lines.push(`  ✅ Passing:       ${report.summary.passingRoutes}`);
  lines.push(`  ❌ Exceeding:     ${report.summary.failingRoutes}`);
  lines.push(`  📦 Total JS:      ${formatBytes(report.summary.totalJS)} gzipped`);
  lines.push(`  📊 Average:       ${formatBytes(Math.round(report.summary.averageJS))} per route`);
  lines.push('');

  // Zero JS celebration
  const zeroJSRoutes = report.routes.filter((r) => r.jsBytes === 0);
  if (zeroJSRoutes.length > 0) {
    lines.push(`  🎉 ${zeroJSRoutes.length} routes ship ZERO JavaScript!`);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Group routes by budget type
 */
function groupRoutesByType(routes: RouteAnalysis[]): Record<string, RouteAnalysis[]> {
  const groups: Record<string, RouteAnalysis[]> = {
    marketing: [],
    app: [],
    static: [],
  };

  for (const route of routes) {
    const type = route.budgetType || 'marketing';
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type]?.push(route);
  }

  return groups;
}

/**
 * Create progress bar visualization
 */
function createProgressBar(current: number, max: number, width = 30): string {
  if (max === 0) {
    return current === 0 ? `🟢 ${'─'.repeat(width)}` : `🔴 ${'█'.repeat(width)}`;
  }

  const percentage = Math.min(current / max, 1);
  const filled = Math.round(percentage * width);
  const empty = width - filled;

  const color = percentage <= 0.7 ? '🟢' : percentage <= 0.9 ? '🟡' : '🔴';
  const bar = `${'█'.repeat(filled)}${'░'.repeat(empty)}`;

  return `${color} ${bar}`;
}

/**
 * Format bytes to human-readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

/**
 * Get percentage
 */
function getPercentage(current: number, max: number): number {
  if (max === 0) return current === 0 ? 0 : 100;
  return Math.round((current / max) * 100);
}
