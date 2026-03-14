// vitest.setup.ts
// Provide stub env vars so Next.js server modules (Supabase, etc.) can
// initialise without real credentials during unit/integration tests.

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
process.env.NEXT_PUBLIC_IMOTARA_ANALYSIS = "local"; // keep tests offline
