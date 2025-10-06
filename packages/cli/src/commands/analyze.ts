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

  validateBuildOutput(distPath);
  showProgressMessages(options, projectRoot, distDir);

  try {
    const budgets = await loadBudgets(projectRoot, options.format === 'json');
    const report = await analyzeBundles(distPath, budgets, options);

    displayReport(report, options);
    handleBudgetFailure(report, options);
    showCompletionMessage(options);
  } catch (error) {
    handleAnalysisError(error, options);
  }
}

/**
 * Validate that build output exists
 */
function validateBuildOutput(distPath: string): void {
  if (!existsSync(distPath)) {
    console.error(`❌ Build output not found: ${distPath}`);
    console.error('💡 Run "plank build" first to create a production build');
    process.exit(1);
  }
}

/**
 * Show progress messages for non-JSON formats
 */
function showProgressMessages(options: AnalyzeOptions, projectRoot: string, distDir: string): void {
  if (options.format !== 'json') {
    console.log('📊 Analyzing JavaScript bundle sizes...');
    console.log(`📁 Project root: ${projectRoot}`);
    console.log(`📦 Analyzing: ${distDir}`);
    console.log('');
  }
}

/**
 * Load budgets from configuration
 */
async function loadBudgets(projectRoot: string, silent: boolean): Promise<BudgetConfig> {
  const config = await loadConfig(projectRoot, silent);
  return {
    marketing: config.budgets?.marketing || DEFAULT_BUDGETS.marketing,
    app: config.budgets?.app || DEFAULT_BUDGETS.app,
    static: config.budgets?.static || DEFAULT_BUDGETS.static,
  };
}

/**
 * Display report based on format
 */
function displayReport(report: BudgetReport, options: AnalyzeOptions): void {
  if (options.format === 'json') {
    console.log(JSON.stringify(report, null, 2));
  } else if (options.format === 'html') {
    generateHTMLReport(report);
  } else if (options.whatShips) {
    const whatShips = generateWhatShipsReport(report);
    console.log(whatShips);
  } else {
    displayTextReport(report);
  }
}

/**
 * Handle budget failure and exit if needed
 */
function handleBudgetFailure(report: BudgetReport, options: AnalyzeOptions): void {
  if (options.failOnExceed && report.summary.failingRoutes > 0) {
    if (options.format !== 'json') {
      console.log('');
      console.error(`❌ Build failed: ${report.summary.failingRoutes} routes exceed budget`);
    }
    process.exit(1);
  }
}

/**
 * Show completion message for non-JSON formats
 */
function showCompletionMessage(options: AnalyzeOptions): void {
  if (options.format !== 'json') {
    console.log('');
    console.log('✅ Analysis complete!');
  }
}

/**
 * Handle analysis errors
 */
function handleAnalysisError(error: unknown, options: AnalyzeOptions): void {
  if (options.format !== 'json') {
    console.error('❌ Analysis failed:');
    console.error(error);
  }
  process.exit(1);
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

    const analysis = await analyzeRoute(routePath, jsFiles, budgets, distPath, options);
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
  distPath: string,
  options: AnalyzeOptions
): Promise<RouteAnalysis> {
  // Determine budget type based on route
  const budgetType = determineBudgetType(routePath);
  const budget = budgets[budgetType as keyof BudgetConfig];

  // Get route-specific JavaScript files
  const routeJsFiles = await getRouteSpecificFiles(routePath, jsFiles, distPath, options);

  // Calculate total JS for this route
  let totalJSBytes = 0;
  let totalJSBytesRaw = 0;
  const breakdown: BundleBreakdown = {
    runtime: 0,
    islands: 0,
    vendor: 0,
    app: 0,
  };

  for (const jsFile of routeJsFiles) {
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
 * Get route-specific JavaScript files for analysis
 */
async function getRouteSpecificFiles(
  routePath: string,
  allJsFiles: string[],
  distPath: string,
  _options: AnalyzeOptions
): Promise<string[]> {
  const routeFiles: string[] = [];

  // Get the HTML file for this route
  const htmlFile = getHtmlFileForRoute(routePath);
  const htmlPath = join(distPath, htmlFile);

  try {
    if (existsSync(htmlPath)) {
      const htmlContent = await readFile(htmlPath, 'utf-8');
      const islands = extractIslandsFromHtml(htmlContent);

      // Only include runtime if there are islands
      if (islands.length > 0) {
        routeFiles.push(...allJsFiles.filter((file) => file.includes('runtime')));
      }

      // Add island files based on what's actually used in the HTML
      for (const island of islands) {
        // Convert Counter.plk -> Counter.js
        const islandName = island.replace('.plk', '');
        const islandFile = allJsFiles.find((file) => file.includes(`islands/${islandName}.js`));
        if (islandFile) {
          routeFiles.push(islandFile);
        }
      }
    }
  } catch {
    // If we can't read the HTML file, fall back to including all islands
    console.warn(`⚠️  Could not analyze HTML for ${routePath}, including all islands`);
    routeFiles.push(...allJsFiles.filter((file) => file.includes('runtime')));
    routeFiles.push(...allJsFiles.filter((file) => file.includes('island')));
  }

  return routeFiles;
}

/**
 * Get the HTML file name for a route
 */
function getHtmlFileForRoute(routePath: string): string {
  if (routePath === '/') return 'index.html';
  return `${routePath.slice(1)}.html`;
}

/**
 * Extract island names from HTML content
 */
function extractIslandsFromHtml(htmlContent: string): string[] {
  const islands: string[] = [];

  // Look for data-island attributes
  const dataIslandRegex = /data-island="\.\/islands\/([^"]+)"/g;
  let match: RegExpExecArray | null;
  match = dataIslandRegex.exec(htmlContent);
  while (match !== null) {
    if (match[1]) {
      islands.push(match[1]);
    }
    match = dataIslandRegex.exec(htmlContent);
  }

  // Look for island tags in code examples
  const islandTagRegex = /island src="\.\/islands\/([^"]+)"/g;
  match = islandTagRegex.exec(htmlContent);
  while (match !== null) {
    if (match[1]) {
      islands.push(match[1]);
    }
    match = islandTagRegex.exec(htmlContent);
  }

  return [...new Set(islands)]; // Remove duplicates
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
 * Find all HTML files in dist directory
 */
async function findHTMLFiles(distPath: string): Promise<string[]> {
  const htmlFiles: string[] = [];

  async function scan(dir: string, prefix = ''): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await scan(join(dir, entry.name), relativePath);
      } else if (entry.name.endsWith('.html')) {
        htmlFiles.push(relativePath);
      }
    }
  }

  await scan(distPath);
  return htmlFiles;
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
    console.warn('⚠️  Could not load route manifest, scanning HTML files');
  }

  // Fallback: scan HTML files in dist directory
  const routes: string[] = [];

  try {
    const htmlFiles = await findHTMLFiles(distPath);

    for (const htmlFile of htmlFiles) {
      if (htmlFile === 'index.html') {
        routes.push('/');
      } else {
        // Convert about.html -> /about
        const route = `/${htmlFile.replace('.html', '')}`;
        routes.push(route);
      }
    }

    return routes.sort();
  } catch (_error) {
    console.warn('⚠️  Could not scan HTML files, using minimal fallback');
    return ['/'];
  }
}

/**
 * Display text report
 */
function displayTextReport(report: BudgetReport): void {
  displayReportHeader();
  displayBudgetConfiguration(report);
  displayRouteAnalysis(report);
  displaySummary(report);
}

/**
 * Display report header
 */
function displayReportHeader(): void {
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│                    📊 BUNDLE SIZE ANALYSIS                  │');
  console.log('└─────────────────────────────────────────────────────────────┘');
  console.log('');
}

/**
 * Display budget configuration table
 */
function displayBudgetConfiguration(report: BudgetReport): void {
  console.log('💰 Budget Configuration:');
  console.log('┌─────────────┬─────────────┬─────────────┐');
  console.log('│ Type        │ Budget      │ Status      │');
  console.log('├─────────────┼─────────────┼─────────────┤');

  const status = report.summary.failingRoutes > 0 ? '❌ FAIL' : '✅ PASS';
  console.log(`│ Marketing   │ ${formatBytes(report.budgets.marketing).padEnd(10)} │ ${status}`);
  console.log(`│ App         │ ${formatBytes(report.budgets.app).padEnd(10)} │ ${status}`);
  console.log(`│ Static      │ ${formatBytes(report.budgets.static).padEnd(10)} │ ${status}`);
  console.log('└─────────────┴─────────────┴─────────────┘');
  console.log('');
}

/**
 * Display route analysis
 */
function displayRouteAnalysis(report: BudgetReport): void {
  console.log('📍 Route Analysis:');
  console.log('');

  for (const route of report.routes) {
    displayRouteDetails(route);
  }
}

/**
 * Display details for a single route
 */
function displayRouteDetails(route: RouteAnalysis): void {
  const statusIcon = route.status === 'pass' ? '✅' : '❌';
  const budgetPercent = Math.round((route.jsBytes / route.budget) * 100);
  const statusColor = route.status === 'pass' ? '🟢' : '🔴';

  console.log(`${statusIcon} ${route.path}`);
  console.log(
    `   ${statusColor} ${route.budgetType.toUpperCase()} • ${formatBytes(route.jsBytes)} / ${formatBytes(route.budget)} (${budgetPercent}%)`
  );

  if (route.jsBytes > 0) {
    displayRouteBreakdown(route.breakdown);
  }

  if (route.recommendations.length > 0) {
    displayRouteRecommendations(route.recommendations);
  }

  console.log('');
}

/**
 * Display route breakdown
 */
function displayRouteBreakdown(breakdown: BundleBreakdown): void {
  console.log('   📦 Breakdown:');
  if (breakdown.runtime > 0) {
    console.log(`      Runtime: ${formatBytes(breakdown.runtime)}`);
  }
  if (breakdown.islands > 0) {
    console.log(`      Islands: ${formatBytes(breakdown.islands)}`);
  }
  if (breakdown.vendor > 0) {
    console.log(`      Vendor:  ${formatBytes(breakdown.vendor)}`);
  }
  if (breakdown.app > 0) {
    console.log(`      App:     ${formatBytes(breakdown.app)}`);
  }
}

/**
 * Display route recommendations
 */
function displayRouteRecommendations(recommendations: string[]): void {
  console.log('   💡 Recommendations:');
  for (const rec of recommendations) {
    console.log(`      ${rec}`);
  }
}

/**
 * Display summary
 */
function displaySummary(report: BudgetReport): void {
  console.log('┌─────────────────────────────────────────────────────────────┐');
  console.log('│                         📈 SUMMARY                         │');
  console.log('├─────────────────────────────────────────────────────────────┤');
  console.log(`│ Total Routes: ${report.summary.totalRoutes.toString().padEnd(45)} │`);
  console.log(`│ ✅ Passing:   ${report.summary.passingRoutes.toString().padEnd(45)} │`);
  console.log(`│ ❌ Failing:   ${report.summary.failingRoutes.toString().padEnd(45)} │`);
  console.log(`│ 📦 Total JS:  ${formatBytes(report.summary.totalJS).padEnd(45)} │`);
  console.log(`│ 📊 Average:   ${formatBytes(Math.round(report.summary.averageJS)).padEnd(45)} │`);
  console.log('└─────────────────────────────────────────────────────────────┘');
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
