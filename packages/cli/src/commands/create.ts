/**
 * @fileoverview Create command implementation
 */

import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

export interface CreateOptions {
  template?: string;
  typescript?: boolean;
  tailwind?: boolean;
}

export async function createCommand(
  projectName: string,
  options: CreateOptions = {}
): Promise<void> {
  const projectPath = resolve(process.cwd(), projectName);

  // Check if directory already exists
  if (existsSync(projectPath)) {
    console.error(`❌ Directory "${projectName}" already exists`);
    process.exit(1);
  }

  console.log(`🚀 Creating new Plank project: ${projectName}`);
  console.log(`📁 Project path: ${projectPath}`);

  try {
    // Create project directory
    await mkdir(projectPath, { recursive: true });

    // Create basic project structure
    await createProjectStructure(projectPath, projectName, options);

    console.log('✅ Project created successfully!');
    console.log('');
    console.log('📝 Next steps:');
    console.log(`   cd ${projectName}`);
    console.log('   pnpm install');
    console.log('   pnpm dev');
    console.log('');
    console.log('🎉 Happy coding with Plank!');
  } catch (error) {
    console.error('❌ Failed to create project:');
    console.error(error);
    process.exit(1);
  }
}

async function createProjectStructure(
  projectPath: string,
  projectName: string,
  _options: CreateOptions
): Promise<void> {
  // Create directories
  await mkdir(join(projectPath, 'app', 'routes'), { recursive: true });
  await mkdir(join(projectPath, 'app', 'layouts'), { recursive: true });
  await mkdir(join(projectPath, 'public'), { recursive: true });

  // Create package.json
  const packageJson = {
    name: projectName,
    version: '0.1.0',
    type: 'module',
    scripts: {
      dev: 'plank dev',
      build: 'plank build',
      preview: 'plank preview',
    },
    dependencies: {
      '@plank/compiler': '^0.1.0',
      '@plank/router': '^0.1.0',
      '@plank/ssr': '^0.1.0',
      '@plank/dev-server': '^0.1.0',
    },
    devDependencies: {
      plank: '^0.1.0',
    },
  };

  await writeFile(join(projectPath, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);

  // Create plank.config.ts
  const configContent = `import { defineConfig } from 'plank';

export default defineConfig({
  // Configuration options
  routesDir: './app/routes',
  layoutsDir: './app/layouts',
  publicDir: './public',
});
`;

  await writeFile(join(projectPath, 'plank.config.ts'), configContent);

  // Create root layout
  const rootLayoutContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Plank</title>
</head>
<body>
  <main>
    <slot />
  </main>
</body>
</html>`;

  await writeFile(join(projectPath, 'app', 'layouts', 'root.plk'), rootLayoutContent);

  // Create home page
  const homePageContent = `<div>
  <h1>Welcome to Plank!</h1>
  <p>Your new Plank application is ready to go.</p>
  <p>Edit this file at <code>app/routes/index.plk</code> to get started.</p>
</div>`;

  await writeFile(join(projectPath, 'app', 'routes', 'index.plk'), homePageContent);

  // Create about page
  const aboutPageContent = `<div>
  <h1>About</h1>
  <p>This is the about page.</p>
  <a href="/">← Back to home</a>
</div>`;

  await writeFile(join(projectPath, 'app', 'routes', 'about.plk'), aboutPageContent);

  // Create README
  const readmeContent = `# ${projectName}

A new Plank application.

## Getting Started

1. Install dependencies:
   \`\`\`bash
   pnpm install
   \`\`\`

2. Start the development server:
   \`\`\`bash
   pnpm dev
   \`\`\`

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

- \`app/routes/\` - Your application routes (pages)
- \`app/layouts/\` - Layout components
- \`public/\` - Static assets
- \`plank.config.ts\` - Plank configuration

## Learn More

Visit the [Plank documentation](https://plank.dev) to learn more about building with Plank.
`;

  await writeFile(join(projectPath, 'README.md'), readmeContent);

  // Create .gitignore
  const gitignoreContent = `# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/
.plank/

# Environment variables
.env
.env.local
.env.production

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
`;

  await writeFile(join(projectPath, '.gitignore'), gitignoreContent);
}
