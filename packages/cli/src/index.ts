#!/usr/bin/env node

/**
 * @fileoverview Plank CLI
 * Command-line interface for creating and managing Plank applications
 */

import { program } from 'commander';
import { analyzeCommand } from './commands/analyze.js';
import { buildCommand } from './commands/build.js';
import { createCommand } from './commands/create.js';
import { devCommand } from './commands/dev.js';
import { previewCommand } from './commands/preview.js';

export type { PlankConfig } from './config.js';
// Export configuration helpers for use in plank.config.ts files
export { defineConfig } from './define-config.js';

program
  .name('plank')
  .description('Plank CLI for creating and managing Plank applications')
  .version('0.1.0');

program
  .command('create <project-name>')
  .description('Create a new Plank project')
  .option('-t, --template <template>', 'Project template to use')
  .option('--typescript', 'Use TypeScript')
  .option('--tailwind', 'Include Tailwind CSS')
  .action(async (projectName: string, options) => {
    await createCommand(projectName, options);
  });

program
  .command('dev')
  .description('Start development server')
  .option('-p, --port <port>', 'Port to run the dev server on', '3000')
  .option('-h, --host <host>', 'Host to bind the server to', 'localhost')
  .option('--no-open', "Don't open browser automatically")
  .option('--routes-dir <dir>', 'Routes directory', './app/routes')
  .option('--https', 'Enable HTTPS')
  .action(async (options) => {
    await devCommand(options);
  });

program
  .command('build')
  .description('Build the project for production')
  .option('-o, --output <dir>', 'Output directory', './dist')
  .option('--no-minify', 'Disable minification')
  .option('--sourcemap', 'Generate source maps')
  .action(async (options) => {
    await buildCommand(options);
  });

program
  .command('preview')
  .description('Preview the production build')
  .option('-p, --port <port>', 'Port to run the preview server on', '3000')
  .option('-h, --host <host>', 'Host to bind the server to', 'localhost')
  .option('-d, --dist <dir>', 'Build output directory', './dist')
  .action(async (options) => {
    await previewCommand(options);
  });

program
  .command('analyze')
  .description('Analyze bundle size and performance budgets')
  .option('-d, --dist <dir>', 'Distribution directory to analyze', './dist')
  .option('-r, --route <route>', 'Analyze specific route')
  .option('-b, --budget <type>', 'Check specific budget type (marketing, app, static)')
  .option('--fail-on-exceed', 'Fail if budgets are exceeded')
  .option('-f, --format <format>', 'Output format (text, json, html)', 'text')
  .action(async (options) => {
    await analyzeCommand(options);
  });

program.parse();
