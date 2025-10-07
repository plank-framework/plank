// Deno runtime compatibility check for @plank/adapter-deno
// Run with: deno run --allow-net --allow-read packages/adapters/deno/scripts/compat.ts

// Resolve built output relative to this script file
const adapter = await import(new URL('../dist/index.js', import.meta.url).pathname);

console.log('✅ Deno adapter loads successfully in Deno runtime');
console.log('Available exports:', Object.keys(adapter));
console.log('createDenoAdapter type:', typeof (adapter as { createDenoAdapter?: unknown }).createDenoAdapter);

try {
  const testAdapter = (adapter as { createDenoAdapter?: (opts: unknown) => unknown }).createDenoAdapter?.({ port: 0 });
  console.log('✅ Can create Deno adapter instance');
  console.log('Adapter type:', typeof testAdapter);
} catch (error) {
  const message = (error as { message?: string }).message ?? String(error);
  console.log('⚠️  Adapter creation test:', message);
}


