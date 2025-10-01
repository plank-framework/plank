/**
 * @fileoverview Integration tests for router with real file system operations
 */

import { afterEach, describe, expect, test } from 'vitest';
import { discoverRouteFiles } from '../route-discovery.js';
import { FileBasedRouter } from '../router.js';
import type { RouterConfig } from '../types.js';

describe('Router Integration Tests', () => {
  let tempDir: string;
  let routesDir: string;
  let layoutsDir: string;

  afterEach(async () => {
    if (tempDir) {
      await import('node:fs/promises').then((fs) =>
        fs.rm(tempDir, { recursive: true, force: true })
      );
    }
  });

  test('should discover routes from actual files', async () => {
    const { mkdtemp, writeFile, mkdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');

    // Create temporary directory structure
    tempDir = await mkdtemp(join(tmpdir(), 'plank-router-test-'));
    routesDir = join(tempDir, 'routes');
    layoutsDir = join(tempDir, 'layouts');

    await mkdir(routesDir, { recursive: true });
    await mkdir(layoutsDir, { recursive: true });

    // Create actual route files
    await writeFile(join(routesDir, 'index.plk'), '<h1>Home</h1>');

    // Create subdirectories first
    await mkdir(join(routesDir, 'users'), { recursive: true });
    await mkdir(join(routesDir, 'posts'), { recursive: true });

    await writeFile(join(routesDir, 'users', '[id].plk'), '<h1>User {id}</h1>');
    await writeFile(join(routesDir, 'posts', '[...slug].plk'), '<h1>Post {slug}</h1>');
    await writeFile(join(layoutsDir, 'main.plk'), '<div class="layout">{children}</div>');

    const config: RouterConfig = {
      routesDir,
      layoutsDir,
      extensions: ['.plk'],
      defaultLayout: undefined,
      generateManifest: false,
      manifestPath: undefined,
      watch: false,
    };

    const router = new FileBasedRouter(config);
    await router.initialize();

    // Test route discovery
    const routes = router.getRoutes();
    console.log(
      'Router routes:',
      routes.map((r) => ({ path: r.path, filePath: r.filePath }))
    );
    expect(routes.length).toBeGreaterThan(0);

    // Test route matching with actual routes
    const homeMatch = router.match('/');
    expect(homeMatch).not.toBeNull();
    expect(homeMatch?.route.path).toBe('/');

    const userMatch = router.match('/users/123');
    expect(userMatch).not.toBeNull();
    expect(userMatch?.params.id).toBe('123');

    const postMatch = router.match('/posts/hello/world');
    expect(postMatch).not.toBeNull();
    expect(postMatch?.params.slug).toBe('hello/world');
  });

  test('should handle parameter extraction with real routes', async () => {
    const { mkdtemp, writeFile, mkdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');

    tempDir = await mkdtemp(join(tmpdir(), 'plank-router-params-'));
    routesDir = join(tempDir, 'routes');

    await mkdir(routesDir, { recursive: true });

    // Create routes with various parameter types
    await mkdir(join(routesDir, 'api', '[version]', 'users'), { recursive: true });
    await mkdir(join(routesDir, 'posts'), { recursive: true });
    await mkdir(join(routesDir, 'users', '[[id]]'), { recursive: true });

    await writeFile(join(routesDir, 'api', '[version]', 'users', '[id].plk'), 'API User');
    await writeFile(join(routesDir, 'posts', '[...slug].plk'), 'Post');
    await writeFile(join(routesDir, 'users', '[[id]]', 'profile.plk'), 'Profile');

    const config: RouterConfig = {
      routesDir,
      layoutsDir: '',
      extensions: ['.plk'],
      defaultLayout: undefined,
      generateManifest: false,
      manifestPath: undefined,
      watch: false,
    };

    const router = new FileBasedRouter(config);
    await router.initialize();

    // Test complex parameter extraction
    const apiMatch = router.match('/api/v1/users/123');
    expect(apiMatch).not.toBeNull();
    expect(apiMatch?.params.version).toBe('v1');
    expect(apiMatch?.params.id).toBe('123');

    // Test catch-all parameter extraction
    const catchAllMatch = router.match('/posts/hello/world/test');
    expect(catchAllMatch).not.toBeNull();
    expect(catchAllMatch?.params.slug).toBe('hello/world/test');

    // Test optional parameter extraction
    const optionalMatch = router.match('/users/456/profile');
    expect(optionalMatch).not.toBeNull();
    expect(optionalMatch?.params.id).toBe('456');

    // Test optional parameter without the parameter
    const optionalNoParamMatch = router.match('/users/profile');
    expect(optionalNoParamMatch).not.toBeNull();
    expect(optionalNoParamMatch?.params.id).toBeUndefined();
  });

  test('should handle comprehensive parameter extraction scenarios', async () => {
    const { mkdtemp, writeFile, mkdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');

    tempDir = await mkdtemp(join(tmpdir(), 'plank-router-params-'));
    routesDir = join(tempDir, 'routes');

    await mkdir(routesDir, { recursive: true });

    // Create various route patterns for comprehensive testing
    await writeFile(join(routesDir, 'index.plk'), '<h1>Home</h1>');

    // Simple dynamic route
    await mkdir(join(routesDir, 'user'), { recursive: true });
    await writeFile(join(routesDir, 'user', '[id].plk'), '<h1>User {id}</h1>');

    // Multiple dynamic segments
    await mkdir(join(routesDir, 'posts'), { recursive: true });
    await mkdir(join(routesDir, 'posts', '[category]'), { recursive: true });
    await writeFile(
      join(routesDir, 'posts', '[category]', '[slug].plk'),
      '<h1>Post {category}/{slug}</h1>'
    );

    // Catch-all route
    await mkdir(join(routesDir, 'docs'), { recursive: true });
    await writeFile(join(routesDir, 'docs', '[...path].plk'), '<h1>Docs {path}</h1>');

    // Optional parameter route
    await mkdir(join(routesDir, 'api'), { recursive: true });
    await mkdir(join(routesDir, 'api', '[[version]]'), { recursive: true });
    await writeFile(
      join(routesDir, 'api', '[[version]]', 'users.plk'),
      '<h1>API Users {version}</h1>'
    );

    // Complex nested dynamic route
    await mkdir(join(routesDir, 'admin'), { recursive: true });
    await mkdir(join(routesDir, 'admin', '[section]'), { recursive: true });
    await mkdir(join(routesDir, 'admin', '[section]', '[action]'), { recursive: true });
    await writeFile(
      join(routesDir, 'admin', '[section]', '[action]', 'index.plk'),
      '<h1>Admin {section}/{action}</h1>'
    );

    const config: RouterConfig = {
      routesDir,
      layoutsDir: '',
      extensions: ['.plk'],
      defaultLayout: undefined,
      generateManifest: false,
      manifestPath: undefined,
      watch: false,
    };

    const router = new FileBasedRouter(config);
    await router.initialize();

    // Test 1: Simple dynamic parameter
    const userMatch = router.match('/user/123');
    expect(userMatch).not.toBeNull();
    expect(userMatch?.params.id).toBe('123');
    expect(userMatch?.route.path).toBe('/user/[id]');

    // Test 2: Multiple dynamic parameters
    const postMatch = router.match('/posts/tech/nextjs-guide');
    expect(postMatch).not.toBeNull();
    expect(postMatch?.params.category).toBe('tech');
    expect(postMatch?.params.slug).toBe('nextjs-guide');
    expect(postMatch?.route.path).toBe('/posts/[category]/[slug]');

    // Test 3: Catch-all parameter
    const docsMatch = router.match('/docs/getting-started/installation/quick-start');
    expect(docsMatch).not.toBeNull();
    expect(docsMatch?.params.path).toBe('getting-started/installation/quick-start');
    expect(docsMatch?.route.path).toBe('/docs/[...path]');

    // Test 4: Optional parameter with value
    const apiWithVersion = router.match('/api/v2/users');
    expect(apiWithVersion).not.toBeNull();
    expect(apiWithVersion?.params.version).toBe('v2');
    expect(apiWithVersion?.route.path).toBe('/api/[[version]]/users');

    // Test 5: Optional parameter without value
    const apiWithoutVersion = router.match('/api/users');
    expect(apiWithoutVersion).not.toBeNull();
    expect(apiWithoutVersion?.params.version).toBeUndefined();
    expect(apiWithoutVersion?.route.path).toBe('/api/[[version]]/users');

    // Test 6: Complex nested dynamic route
    const adminMatch = router.match('/admin/users/create');
    expect(adminMatch).not.toBeNull();
    expect(adminMatch?.params.section).toBe('users');
    expect(adminMatch?.params.action).toBe('create');
    expect(adminMatch?.route.path).toBe('/admin/[section]/[action]');

    // Test 7: Edge case - empty catch-all
    const emptyCatchAll = router.match('/docs');
    expect(emptyCatchAll).not.toBeNull();
    expect(emptyCatchAll?.params.path).toBe('');
    expect(emptyCatchAll?.route.path).toBe('/docs/[...path]');

    // Test 8: Edge case - single segment catch-all
    const singleCatchAll = router.match('/docs/guide');
    expect(singleCatchAll).not.toBeNull();
    expect(singleCatchAll?.params.path).toBe('guide');
    expect(singleCatchAll?.route.path).toBe('/docs/[...path]');

    // Test 9: No match for invalid route
    const noMatch = router.match('/nonexistent/route');
    expect(noMatch).toBeNull();

    // Test 10: Partial match (should not match)
    const partialMatch = router.match('/posts/tech');
    expect(partialMatch).toBeNull(); // Should not match /posts/[category]/[slug] with only one segment
  });

  test('should handle parameter extraction edge cases and validation', async () => {
    const { mkdtemp, writeFile, mkdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');

    tempDir = await mkdtemp(join(tmpdir(), 'plank-router-edge-'));
    routesDir = join(tempDir, 'routes');

    await mkdir(routesDir, { recursive: true });

    // Create edge case routes
    await writeFile(join(routesDir, 'index.plk'), '<h1>Home</h1>');

    // Route with special characters in parameters
    await mkdir(join(routesDir, 'search'), { recursive: true });
    await writeFile(join(routesDir, 'search', '[query].plk'), '<h1>Search {query}</h1>');

    // Route with numeric parameters
    await mkdir(join(routesDir, 'product'), { recursive: true });
    await writeFile(join(routesDir, 'product', '[id].plk'), '<h1>Product {id}</h1>');

    // Route with mixed parameter types
    await mkdir(join(routesDir, 'user'), { recursive: true });
    await mkdir(join(routesDir, 'user', '[userId]'), { recursive: true });
    await mkdir(join(routesDir, 'user', '[userId]', 'post'), { recursive: true });
    await writeFile(
      join(routesDir, 'user', '[userId]', 'post', '[postId].plk'),
      '<h1>User {userId} Post {postId}</h1>'
    );

    // Catch-all with special characters
    await mkdir(join(routesDir, 'files'), { recursive: true });
    await writeFile(join(routesDir, 'files', '[...path].plk'), '<h1>File {path}</h1>');

    // Optional parameter with complex path
    await mkdir(join(routesDir, 'api'), { recursive: true });
    await mkdir(join(routesDir, 'api', '[[version]]'), { recursive: true });
    await mkdir(join(routesDir, 'api', '[[version]]', 'data'), { recursive: true });
    await writeFile(
      join(routesDir, 'api', '[[version]]', 'data', '[type].plk'),
      '<h1>API {version} Data {type}</h1>'
    );

    const config: RouterConfig = {
      routesDir,
      layoutsDir: '',
      extensions: ['.plk'],
      defaultLayout: undefined,
      generateManifest: false,
      manifestPath: undefined,
      watch: false,
    };

    const router = new FileBasedRouter(config);
    await router.initialize();

    // Test 1: Special characters in parameters
    const searchMatch = router.match('/search/hello%20world');
    expect(searchMatch).not.toBeNull();
    expect(searchMatch?.params.query).toBe('hello%20world');
    expect(searchMatch?.route.path).toBe('/search/[query]');

    // Test 2: Numeric parameters
    const productMatch = router.match('/product/12345');
    expect(productMatch).not.toBeNull();
    expect(productMatch?.params.id).toBe('12345');
    expect(productMatch?.route.path).toBe('/product/[id]');

    // Test 3: Mixed parameter types
    const userPostMatch = router.match('/user/abc123/post/xyz789');
    expect(userPostMatch).not.toBeNull();
    expect(userPostMatch?.params.userId).toBe('abc123');
    expect(userPostMatch?.params.postId).toBe('xyz789');
    expect(userPostMatch?.route.path).toBe('/user/[userId]/post/[postId]');

    // Test 4: Catch-all with special characters and slashes
    const fileMatch = router.match('/files/images/2023/12/photo%20(1).jpg');
    expect(fileMatch).not.toBeNull();
    expect(fileMatch?.params.path).toBe('images/2023/12/photo%20(1).jpg');
    expect(fileMatch?.route.path).toBe('/files/[...path]');

    // Test 5: Optional parameter with complex nested path
    const apiWithVersion = router.match('/api/v2/data/users');
    expect(apiWithVersion).not.toBeNull();
    expect(apiWithVersion?.params.version).toBe('v2');
    expect(apiWithVersion?.params.type).toBe('users');
    expect(apiWithVersion?.route.path).toBe('/api/[[version]]/data/[type]');

    // Test 6: Optional parameter without version
    const apiWithoutVersion = router.match('/api/data/products');
    expect(apiWithoutVersion).not.toBeNull();
    expect(apiWithoutVersion?.params.version).toBeUndefined();
    expect(apiWithoutVersion?.params.type).toBe('products');
    expect(apiWithoutVersion?.route.path).toBe('/api/[[version]]/data/[type]');

    // Test 7: Empty string parameter (trailing slash should not match dynamic route)
    const emptySearch = router.match('/search/');
    expect(emptySearch).toBeNull(); // Trailing slash doesn't match dynamic route

    // Test 8: Very long parameter value
    const longParam = 'a'.repeat(1000);
    const longParamMatch = router.match(`/search/${longParam}`);
    expect(longParamMatch).not.toBeNull();
    expect(longParamMatch?.params.query).toBe(longParam);
    expect(longParamMatch?.route.path).toBe('/search/[query]');

    // Test 9: Unicode characters in parameters
    const unicodeMatch = router.match('/search/测试参数');
    expect(unicodeMatch).not.toBeNull();
    expect(unicodeMatch?.params.query).toBe('测试参数');
    expect(unicodeMatch?.route.path).toBe('/search/[query]');

    // Test 10: Multiple slashes in catch-all (should be preserved)
    const multiSlashMatch = router.match('/files//double//slash//path');
    expect(multiSlashMatch).not.toBeNull();
    expect(multiSlashMatch?.params.path).toBe('/double//slash//path');
    expect(multiSlashMatch?.route.path).toBe('/files/[...path]');
  });

  test('should handle query parameter extraction', async () => {
    const { mkdtemp, writeFile, mkdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');

    tempDir = await mkdtemp(join(tmpdir(), 'plank-router-query-'));
    routesDir = join(tempDir, 'routes');

    await mkdir(routesDir, { recursive: true });
    await writeFile(join(routesDir, 'search.plk'), 'Search');

    const config: RouterConfig = {
      routesDir,
      layoutsDir: '',
      extensions: ['.plk'],
      defaultLayout: undefined,
      generateManifest: false,
      manifestPath: undefined,
      watch: false,
    };

    const router = new FileBasedRouter(config);
    await router.initialize();

    // Debug: Check what routes were discovered
    const routes = router.getRoutes();
    console.log(
      'Search test routes:',
      routes.map((r) => ({ path: r.path, filePath: r.filePath }))
    );

    // Test query parameter extraction
    const searchMatch = router.match('/search?q=hello&page=2&filter=active');
    console.log('Search match result:', searchMatch);
    expect(searchMatch).not.toBeNull();
    expect(searchMatch?.query.q).toBe('hello');
    expect(searchMatch?.query.page).toBe('2');
    expect(searchMatch?.query.filter).toBe('active');

    // Test URL-encoded query parameters
    const encodedMatch = router.match('/search?q=hello%20world&tags=tag1%2Ctag2');
    expect(encodedMatch).not.toBeNull();
    expect(encodedMatch?.query.q).toBe('hello world');
    expect(encodedMatch?.query.tags).toBe('tag1,tag2');
  });

  test('should handle layout hierarchy with nested layouts', async () => {
    const { mkdtemp, writeFile, mkdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');

    tempDir = await mkdtemp(join(tmpdir(), 'plank-router-layouts-'));
    routesDir = join(tempDir, 'routes');
    layoutsDir = join(tempDir, 'layouts');

    await mkdir(routesDir, { recursive: true });
    await mkdir(layoutsDir, { recursive: true });

    // Create nested layout structure
    await writeFile(join(layoutsDir, 'layout.plk'), '<html>{children}</html>');
    await mkdir(join(layoutsDir, 'app'), { recursive: true });
    await writeFile(join(layoutsDir, 'app', 'layout.plk'), '<div class="app">{children}</div>');
    await mkdir(join(layoutsDir, 'admin'), { recursive: true });
    await writeFile(join(layoutsDir, 'admin', 'layout.plk'), '<div class="admin">{children}</div>');
    await writeFile(join(routesDir, 'index.plk'), '<h1>Home</h1>');

    // Create admin subdirectory
    await mkdir(join(routesDir, 'admin'), { recursive: true });
    await writeFile(join(routesDir, 'admin', 'users.plk'), '<h1>Admin Users</h1>');

    const config: RouterConfig = {
      routesDir,
      layoutsDir,
      extensions: ['.plk'],
      defaultLayout: undefined,
      generateManifest: false,
      manifestPath: undefined,
      watch: false,
    };

    const router = new FileBasedRouter(config);
    await router.initialize();

    // Test layout hierarchy
    const homeHierarchy = router.getLayoutHierarchy('/');
    expect(homeHierarchy.length).toBeGreaterThan(0);

    const adminHierarchy = router.getLayoutHierarchy('/admin/users');
    expect(adminHierarchy.length).toBeGreaterThan(0);

    // Test routes by layout - all routes should use the root layout
    const rootLayoutPath = join(layoutsDir, 'layout.plk');
    const rootRoutes = router.getRoutesByLayout(rootLayoutPath);
    expect(rootRoutes.length).toBeGreaterThan(0);
  });

  test('should discover actual route files from filesystem', async () => {
    const { mkdtemp, writeFile, mkdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');

    // Create temporary directory structure
    tempDir = await mkdtemp(join(tmpdir(), 'plank-discovery-test-'));
    routesDir = join(tempDir, 'routes');

    await mkdir(routesDir, { recursive: true });

    // Create actual route files with various patterns
    await writeFile(join(routesDir, 'index.plk'), '<h1>Home</h1>');
    await writeFile(join(routesDir, 'about.plk'), '<h1>About</h1>');

    // Create subdirectories first
    await mkdir(join(routesDir, 'users'), { recursive: true });
    await mkdir(join(routesDir, 'posts'), { recursive: true });
    await mkdir(join(routesDir, 'api', '[[version]]'), { recursive: true });

    await writeFile(join(routesDir, 'users', '[id].plk'), '<h1>User {id}</h1>');
    await writeFile(join(routesDir, 'posts', '[...slug].plk'), '<h1>Post {slug}</h1>');
    await writeFile(join(routesDir, 'api', '[[version]]', 'users.plk'), '<h1>API Users</h1>');
    // Layout files should be in layouts directory, not routes directory
    // await writeFile(join(routesDir, 'layout.plk'), '<div class="layout">{children}</div>');

    // Test actual file discovery
    const files = await discoverRouteFiles(routesDir, ['.plk']);

    expect(files.length).toBeGreaterThan(0);

    // Test that different file types are detected
    const pageFiles = files.filter((f) => f.type === 'page');
    const layoutFiles = files.filter((f) => f.type === 'layout');

    expect(pageFiles.length).toBeGreaterThan(0);
    // Layout files should be in layouts directory, not routes directory
    expect(layoutFiles.length).toBe(0);

    // Test that dynamic routes are detected
    const dynamicFiles = files.filter((f) => f.isDynamic);
    expect(dynamicFiles.length).toBeGreaterThan(0);

    // Test that catch-all routes are detected
    const catchAllFiles = files.filter((f) => f.isCatchAll);
    expect(catchAllFiles.length).toBeGreaterThan(0);

    // Test parameter extraction
    const userFile = files.find((f) => f.routePath === '/users/[id]');
    expect(userFile).toBeDefined();
    expect(userFile?.params).toContain('id');

    const postFile = files.find((f) => f.routePath === '/posts/[...slug]');
    expect(postFile).toBeDefined();
    expect(postFile?.params).toContain('...slug');
  });

  test('should handle file watching with real file changes', async () => {
    const { mkdtemp, writeFile, mkdir, unlink, rmdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');

    tempDir = await mkdtemp(join(tmpdir(), 'plank-router-watch-'));
    routesDir = join(tempDir, 'routes');

    await mkdir(routesDir, { recursive: true });

    // Create initial route files
    await writeFile(join(routesDir, 'index.plk'), '<h1>Home</h1>');
    await writeFile(join(routesDir, 'about.plk'), '<h1>About</h1>');

    const config: RouterConfig = {
      routesDir,
      layoutsDir: '',
      extensions: ['.plk'],
      defaultLayout: undefined,
      generateManifest: false,
      manifestPath: undefined,
      watch: true, // Enable file watching
    };

    const router = new FileBasedRouter(config);
    await router.initialize();

    // Verify initial routes
    const initialRoutes = router.getRoutes();
    expect(initialRoutes).toHaveLength(2);
    expect(initialRoutes.some((r) => r.path === '/')).toBe(true);
    expect(initialRoutes.some((r) => r.path === '/about')).toBe(true);

    // Test 1: Add a new route file
    await writeFile(join(routesDir, 'contact.plk'), '<h1>Contact</h1>');

    // Wait for file system event to be processed
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify new route was discovered
    const routesAfterAdd = router.getRoutes();
    expect(routesAfterAdd).toHaveLength(3);
    expect(routesAfterAdd.some((r) => r.path === '/contact')).toBe(true);

    // Test 2: Create a new directory with a route
    await mkdir(join(routesDir, 'products'), { recursive: true });
    await writeFile(join(routesDir, 'products', 'index.plk'), '<h1>Products</h1>');

    // Wait for file system event to be processed
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify new route was discovered
    const routesAfterDir = router.getRoutes();
    expect(routesAfterDir).toHaveLength(4);
    expect(routesAfterDir.some((r) => r.path === '/products')).toBe(true);

    // Test 3: Create a dynamic route
    await mkdir(join(routesDir, 'product'), { recursive: true });
    await writeFile(join(routesDir, 'product', '[id].plk'), '<h1>Product {id}</h1>');

    // Wait for file system event to be processed
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify dynamic route was discovered
    const routesAfterDynamic = router.getRoutes();
    expect(routesAfterDynamic).toHaveLength(5);
    const dynamicRoute = routesAfterDynamic.find((r) => r.path === '/product/[id]');
    expect(dynamicRoute).toBeDefined();
    expect(dynamicRoute?.isDynamic).toBe(true);

    // Test 4: Create a catch-all route
    await mkdir(join(routesDir, 'docs'), { recursive: true });
    await writeFile(join(routesDir, 'docs', '[...slug].plk'), '<h1>Docs {slug}</h1>');

    // Wait for file system event to be processed
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify catch-all route was discovered
    const routesAfterCatchAll = router.getRoutes();
    expect(routesAfterCatchAll).toHaveLength(6);
    const catchAllRoute = routesAfterCatchAll.find((r) => r.path === '/docs/[...slug]');
    expect(catchAllRoute).toBeDefined();
    expect(catchAllRoute?.isCatchAll).toBe(true);

    // Test 5: Modify an existing route file
    await writeFile(join(routesDir, 'about.plk'), '<h1>About Us - Updated</h1>');

    // Wait for file system event to be processed
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify route still exists (modification doesn't change route structure)
    const routesAfterModify = router.getRoutes();
    expect(routesAfterModify).toHaveLength(6);
    expect(routesAfterModify.some((r) => r.path === '/about')).toBe(true);

    // Test 6: Delete a route file
    await unlink(join(routesDir, 'contact.plk'));

    // Wait for file system event to be processed
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify route was removed
    const routesAfterDelete = router.getRoutes();
    expect(routesAfterDelete).toHaveLength(5);
    expect(routesAfterDelete.some((r) => r.path === '/contact')).toBe(false);

    // Test 7: Delete a directory with routes
    await unlink(join(routesDir, 'product', '[id].plk'));
    await rmdir(join(routesDir, 'product'));

    // Wait for file system event to be processed
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify route was removed
    const routesAfterDirDelete = router.getRoutes();
    expect(routesAfterDirDelete).toHaveLength(4);
    expect(routesAfterDirDelete.some((r) => r.path === '/product/[id]')).toBe(false);

    // Test 8: Test route matching still works after changes
    const homeMatch = router.match('/');
    expect(homeMatch).not.toBeNull();
    expect(homeMatch?.route.path).toBe('/');

    const aboutMatch = router.match('/about');
    expect(aboutMatch).not.toBeNull();
    expect(aboutMatch?.route.path).toBe('/about');

    const productsMatch = router.match('/products');
    expect(productsMatch).not.toBeNull();
    expect(productsMatch?.route.path).toBe('/products');

    const docsMatch = router.match('/docs/getting-started');
    expect(docsMatch).not.toBeNull();
    expect(docsMatch?.route.path).toBe('/docs/[...slug]');
    expect(docsMatch?.params.slug).toBe('getting-started');

    // Test 9: Test that deleted routes no longer match
    const contactMatch = router.match('/contact');
    expect(contactMatch).toBeNull();

    const productMatch = router.match('/product/123');
    expect(productMatch).toBeNull();

    // Clean up
    router.stopWatching();
  });

  test('should handle file watching with layout changes', async () => {
    const { mkdtemp, writeFile, mkdir, unlink, rmdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');

    tempDir = await mkdtemp(join(tmpdir(), 'plank-router-layout-watch-'));
    routesDir = join(tempDir, 'routes');
    const layoutsDir = join(tempDir, 'layouts');

    await mkdir(routesDir, { recursive: true });
    await mkdir(layoutsDir, { recursive: true });

    // Create initial files
    await writeFile(join(routesDir, 'index.plk'), '<h1>Home</h1>');
    await writeFile(join(layoutsDir, 'layout.plk'), '<html>{children}</html>');

    const config: RouterConfig = {
      routesDir,
      layoutsDir,
      extensions: ['.plk'],
      defaultLayout: undefined,
      generateManifest: false,
      manifestPath: undefined,
      watch: true, // Enable file watching
    };

    const router = new FileBasedRouter(config);
    await router.initialize();

    // Verify initial state
    const initialRoutes = router.getRoutes();
    const initialLayouts = router.getLayouts();
    expect(initialRoutes).toHaveLength(1);
    expect(initialLayouts).toHaveLength(1);
    expect(initialLayouts[0]?.isRoot).toBe(true);

    // Test 1: Add a new layout
    await mkdir(join(layoutsDir, 'admin'), { recursive: true });
    await writeFile(join(layoutsDir, 'admin', 'layout.plk'), '<div class="admin">{children}</div>');

    // Wait for file system event to be processed
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify new layout was discovered
    const layoutsAfterAdd = router.getLayouts();
    expect(layoutsAfterAdd).toHaveLength(2);
    const adminLayout = layoutsAfterAdd.find((l) => l.filePath.includes('admin/layout.plk'));
    expect(adminLayout).toBeDefined();
    expect(adminLayout?.isRoot).toBe(false);

    // Test 2: Add a route that should use the root layout
    await writeFile(join(routesDir, 'about.plk'), '<h1>About</h1>');

    // Wait for file system event to be processed
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify route was added and associated with root layout
    const routesAfterRoute = router.getRoutes();
    expect(routesAfterRoute).toHaveLength(2);
    const aboutRoute = routesAfterRoute.find((r) => r.path === '/about');
    expect(aboutRoute).toBeDefined();
    expect(aboutRoute?.layoutPath).toBeDefined();

    // Test 3: Modify a layout file
    await writeFile(
      join(layoutsDir, 'layout.plk'),
      '<html><head><title>Updated</title></head>{children}</html>'
    );

    // Wait for file system event to be processed
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify layout still exists (modification doesn't change layout structure)
    const layoutsAfterModify = router.getLayouts();
    expect(layoutsAfterModify).toHaveLength(2);
    expect(layoutsAfterModify.some((l) => l.isRoot)).toBe(true);

    // Test 4: Delete a layout
    await unlink(join(layoutsDir, 'admin', 'layout.plk'));
    await rmdir(join(layoutsDir, 'admin'));

    // Wait for file system event to be processed
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Verify layout was removed
    const layoutsAfterDelete = router.getLayouts();
    expect(layoutsAfterDelete).toHaveLength(1);
    expect(layoutsAfterDelete[0]?.isRoot).toBe(true);

    // Test 5: Test layout hierarchy still works
    const homeHierarchy = router.getLayoutHierarchy('/');
    expect(homeHierarchy).toHaveLength(1);
    expect(homeHierarchy[0]?.isRoot).toBe(true);

    // Clean up
    router.stopWatching();
  });

  test('should handle complex directory structures', async () => {
    const { mkdtemp, writeFile, mkdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { tmpdir } = await import('node:os');

    tempDir = await mkdtemp(join(tmpdir(), 'plank-complex-test-'));
    routesDir = join(tempDir, 'routes');

    await mkdir(routesDir, { recursive: true });

    // Create complex nested structure
    await mkdir(join(routesDir, 'api', 'v1', 'users'), { recursive: true });
    await mkdir(join(routesDir, 'admin', 'settings'), { recursive: true });
    await mkdir(join(routesDir, 'blog', 'categories'), { recursive: true });

    await writeFile(join(routesDir, 'api', 'v1', 'users', '[id].plk'), 'API User');
    await writeFile(join(routesDir, 'admin', 'settings', 'index.plk'), 'Admin Settings');
    await writeFile(join(routesDir, 'blog', 'categories', '[...slug].plk'), 'Blog Category');

    const files = await discoverRouteFiles(routesDir, ['.plk']);

    expect(files.length).toBe(3);

    // Test complex route paths
    const apiUserFile = files.find((f) => f.routePath === '/api/v1/users/[id]');
    expect(apiUserFile).toBeDefined();

    const adminFile = files.find((f) => f.routePath === '/admin/settings');
    expect(adminFile).toBeDefined();

    const blogFile = files.find((f) => f.routePath === '/blog/categories/[...slug]');
    expect(blogFile).toBeDefined();
    expect(blogFile?.isCatchAll).toBe(true);
  });
});
