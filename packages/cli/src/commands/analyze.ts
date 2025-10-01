/**
 * @fileoverview Budget analyzer command - validates JS bundle sizes against configured budgets
 */

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { promisify } from 'node:util';
import { gzip } from 'node:zlib';
import { generateWhatShipsReport } from '../analyzer/what-ships.js';
import { loadConfig } from '../config.js';

const gzipAsync = promisify(gzip);

/**
 * Analyze command options
 */
export interface AnalyzeOptions {
  /** Distribution directory to analyze */
  dist?: string;
  /** Specific route to analyze */
  route?: string;
  /** Budget type to check (marketing, app, static) */
  budget?: string;
  /** Fail build if budget exceeded */
  failOnExceed?: boolean;
  /** Output format (text, json, html) */
  format?: 'text' | 'json' | 'html';
  /** Show "what ships" report */
  whatShips?: boolean;
}

/**
 * Budget configuration per route type
 */
export interface BudgetConfig {
  marketing: number; // KB
  app: number; // KB
  static: number; // KB
}

/**
 * Bundle breakdown
 */
export interface BundleBreakdown {
  runtime: number; // KB
  islands: number; // KB
  vendor: number; // KB
  app: number; // KB
}

/**
 * Route analysis result
 */
export interface RouteAnalysis {
  path: string;
  jsBytes: number; // Gzipped
  jsBytesRaw: number; // Uncompressed
  budget: number;
  budgetType: string;
  status: 'pass' | 'warn' | 'fail';
  breakdown: BundleBreakdown;
  recommendations: string[];
}

/**
 * Complete budget report
 */
export interface BudgetReport {
  routes: RouteAnalysis[];
  summary: {
    totalRoutes: number;
    passingRoutes: number;
    failingRoutes: number;
    totalJS: number;
    averageJS: number;
  };
  budgets: BudgetConfig;
}

/**
 * Default budgets (in bytes, gzipped)
 */
const DEFAULT_BUDGETS: BudgetConfig = {
  marketing: 10 * 1024, // 10 KB
  app: 35 * 1024, // 35 KB
  static: 0, // Zero JS
};

/**
 * Analyze command
 */
export async function analyzeCommand(options: AnalyzeOptions = {}): Promise<void> {
  const projectRoot = process.cwd();
  const distDir = options.dist || './dist';
  const distPath = resolve(projectRoot, distDir);

  // Check if build output exists
  if (!existsSync(distPath)) {
    console.error(`❌ Build output not found: ${distPath}`);
    console.error('💡 Run "plank build" first to create a production build');
    process.exit(1);
  }

  console.log('📊 Analyzing JavaScript bundle sizes...');
  console.log(`📁 Project root: ${projectRoot}`);
  console.log(`📦 Analyzing: ${distDir}`);
  console.log('');

  try {
    // Load configuration
    const config = await loadConfig(projectRoot);
    const budgets: BudgetConfig = {
      marketing: config.budgets?.marketing || DEFAULT_BUDGETS.marketing,
      app: config.budgets?.app || DEFAULT_BUDGETS.app,
      static: config.budgets?.static || DEFAULT_BUDGETS.static,
    };

    // Analyze all routes
    const report = await analyzeBundles(distPath, budgets, options);

    // Display report
    if (options.format === 'json') {
      console.log(JSON.stringify(report, null, 2));
    } else if (options.format === 'html') {
      generateHTMLReport(report);
    } else if (options.whatShips) {
      // Display "what ships" report
      const whatShips = generateWhatShipsReport(report);
      console.log(whatShips);
    } else {
      displayTextReport(report);
    }

    // Check if we should fail
    if (options.failOnExceed && report.summary.failingRoutes > 0) {
      console.log('');
      console.error(`❌ Build failed: ${report.summary.failingRoutes} routes exceed budget`);
      process.exit(1);
    }

    console.log('');
    console.log('✅ Analysis complete!');
  } catch (error) {
    console.error('❌ Analysis failed:');
    console.error(error);
    process.exit(1);
  }
}

/**
 * Analyze all bundles in dist directory
 */
async function analyzeBundles(
  distPath: string,
  budgets: BudgetConfig,
  options: AnalyzeOptions
): Promise<BudgetReport> {
  const routes: RouteAnalysis[] = [];

  // Find all JavaScript files
  const jsFiles = await findJavaScriptFiles(distPath);

  // Analyze by route (for now, simulate route analysis)
  const routePaths = await discoverRoutes(distPath);

  for (const routePath of routePaths) {
    // Skip if specific route requested
    if (options.route && routePath !== options.route) {
      continue;
    }

    const analysis = await analyzeRoute(routePath, jsFiles, budgets, distPath);
    routes.push(analysis);
  }

  // Calculate summary
  const summary = {
    totalRoutes: routes.length,
    passingRoutes: routes.filter((r) => r.status === 'pass').length,
    failingRoutes: routes.filter((r) => r.status === 'fail').length,
    totalJS: routes.reduce((sum, r) => sum + r.jsBytes, 0),
    averageJS:
      routes.length > 0 ? routes.reduce((sum, r) => sum + r.jsBytes, 0) / routes.length : 0,
  };

  return {
    routes,
    summary,
    budgets,
  };
}

/**
 * Analyze a specific route
 */
async function analyzeRoute(
  routePath: string,
  jsFiles: string[],
  budgets: BudgetConfig,
  distPath: string
): Promise<RouteAnalysis> {
  // Determine budget type based on route
  const budgetType = determineBudgetType(routePath);
  const budget = budgets[budgetType as keyof BudgetConfig];

  // Calculate total JS for this route
  let totalJSBytes = 0;
  let totalJSBytesRaw = 0;
  const breakdown: BundleBreakdown = {
    runtime: 0,
    islands: 0,
    vendor: 0,
    app: 0,
  };

  for (const jsFile of jsFiles) {
    const filePath = join(distPath, jsFile);
    const content = await readFile(filePath);

    // Get raw size
    const rawSize = content.length;
    totalJSBytesRaw += rawSize;

    // Get gzipped size
    const gzipped = await gzipAsync(content);
    const gzipSize = gzipped.length;
    totalJSBytes += gzipSize;

    // Categorize file
    if (jsFile.includes('runtime')) {
      breakdown.runtime += gzipSize;
    } else if (jsFile.includes('island')) {
      breakdown.islands += gzipSize;
    } else if (jsFile.includes('vendor') || jsFile.includes('node_modules')) {
      breakdown.vendor += gzipSize;
    } else {
      breakdown.app += gzipSize;
    }
  }

  // Determine status
  const status = totalJSBytes === 0 ? 'pass' : totalJSBytes <= budget ? 'pass' : 'fail';

  // Generate recommendations
  const recommendations = generateRecommendations(totalJSBytes, budget, breakdown);

  return {
    path: routePath,
    jsBytes: totalJSBytes,
    jsBytesRaw: totalJSBytesRaw,
    budget,
    budgetType,
    status,
    breakdown,
    recommendations,
  };
}

/**
 * Determine budget type based on route path
 */
function determineBudgetType(routePath: string): string {
  // Static content routes
  if (routePath.includes('/docs') || routePath.includes('/blog')) {
    return 'static';
  }

  // App routes (dashboards, authenticated areas)
  if (routePath.includes('/dashboard') || routePath.includes('/app')) {
    return 'app';
  }

  // Default to marketing
  return 'marketing';
}

/**
 * Generate recommendations based on analysis
 */
function generateRecommendations(
  totalJS: number,
  budget: number,
  breakdown: BundleBreakdown
): string[] {
  const recommendations: string[] = [];

  if (totalJS > budget) {
    recommendations.push(`⚠️  Bundle exceeds budget by ${formatBytes(totalJS - budget)}`);

    // Specific recommendations
    if (breakdown.vendor > budget * 0.5) {
      recommendations.push('Consider reducing vendor dependencies or splitting them');
    }

    if (breakdown.islands > budget * 0.3) {
      recommendations.push('Some islands may be too large - consider lazy loading');
    }

    if (breakdown.app > budget * 0.4) {
      recommendations.push('Application code is large - review for unused exports');
    }
  }

  if (totalJS === 0 && budget === 0) {
    recommendations.push('✅ Perfect! This route ships zero JavaScript');
  }

  return recommendations;
}

/**
 * Find all JavaScript files in dist directory
 */
async function findJavaScriptFiles(distPath: string): Promise<string[]> {
  const jsFiles: string[] = [];

  async function scan(dir: string, prefix = ''): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await scan(join(dir, entry.name), relativePath);
      } else if (entry.name.endsWith('.js')) {
        jsFiles.push(relativePath);
      }
    }
  }

  await scan(distPath);
  return jsFiles;
}

/**
 * Discover routes from dist directory
 */
async function discoverRoutes(distPath: string): Promise<string[]> {
  // Try to load route manifest from build output
  const manifestPath = resolve(distPath, '../.plank/routes.json');

  try {
    if (existsSync(manifestPath)) {
      const manifestContent = await readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent) as {
        routes: Array<{ path: string }>;
      };

      return manifest.routes.map((r) => r.path);
    }
  } catch (_error) {
    console.warn('⚠️  Could not load route manifest, using defaults');
  }

  // Fallback to common routes if manifest not found
  return ['/', '/features', '/about', '/dashboard'];
}

/**
 * Display text report
 */
function displayTextReport(report: BudgetReport): void {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 BUNDLE SIZE ANALYSIS');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');

  // Display budgets
  console.log('💰 Configured Budgets:');
  console.log(`  Marketing: ${formatBytes(report.budgets.marketing)} gzip`);
  console.log(`  App:       ${formatBytes(report.budgets.app)} gzip`);
  console.log(`  Static:    ${formatBytes(report.budgets.static)} gzip`);
  console.log('');

  // Display per-route analysis
  console.log('📍 Per-Route Analysis:');
  console.log('');

  for (const route of report.routes) {
    const statusIcon = route.status === 'pass' ? '✅' : '❌';
    const budgetPercent = Math.round((route.jsBytes / route.budget) * 100);

    console.log(`${statusIcon} ${route.path}`);
    console.log(`   Type: ${route.budgetType}`);
    console.log(
      `   JavaScript: ${formatBytes(route.jsBytes)} gzip (${formatBytes(route.jsBytesRaw)} raw)`
    );
    console.log(`   Budget: ${formatBytes(route.budget)} (${budgetPercent}% used)`);

    if (route.jsBytes > 0) {
      console.log('   Breakdown:');
      console.log(`     Runtime:  ${formatBytes(route.breakdown.runtime)}`);
      console.log(`     Islands:  ${formatBytes(route.breakdown.islands)}`);
      console.log(`     Vendor:   ${formatBytes(route.breakdown.vendor)}`);
      console.log(`     App:      ${formatBytes(route.breakdown.app)}`);
    }

    if (route.recommendations.length > 0) {
      console.log('   Recommendations:');
      for (const rec of route.recommendations) {
        console.log(`     ${rec}`);
      }
    }

    console.log('');
  }

  // Display summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📈 SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`Total Routes:    ${report.summary.totalRoutes}`);
  console.log(`✅ Passing:      ${report.summary.passingRoutes}`);
  console.log(`❌ Failing:      ${report.summary.failingRoutes}`);
  console.log(`📦 Total JS:     ${formatBytes(report.summary.totalJS)} gzip`);
  console.log(`📊 Average JS:   ${formatBytes(Math.round(report.summary.averageJS))} per route`);
}

/**
 * Generate HTML report
 */
function generateHTMLReport(report: BudgetReport): void {
  console.log('📄 HTML report generation not yet implemented');
  console.log('💡 Use --format=json for machine-readable output');
  displayTextReport(report);
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
