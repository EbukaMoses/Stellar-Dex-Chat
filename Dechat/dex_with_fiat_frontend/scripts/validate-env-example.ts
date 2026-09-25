#!/usr/bin/env tsx
/**
 * Validates that .env.example contains all variables declared in src/lib/env.ts
 * and does not list variables that are not read by the application.
 *
 * Usage:
 *   pnpm exec tsx scripts/validate-env-example.ts
 *
 * Exit codes:
 *   0 - All variables match
 *   1 - Missing variables or extra variables found
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const ENV_EXAMPLE_PATH = join(__dirname, '../.env.example');
const ENV_TS_PATH = join(__dirname, '../src/lib/env.ts');

/**
 * Extract variable names from env.ts schema definitions
 */
function extractEnvTsVariables(): Set<string> {
  const envTsContent = readFileSync(ENV_TS_PATH, 'utf-8');
  const variables = new Set<string>();

  // Match lines like: VARIABLE_NAME: z.string()...
  const schemaPattern = /^\s*([A-Z_][A-Z0-9_]*)\s*:/gm;
  let match;

  while ((match = schemaPattern.exec(envTsContent)) !== null) {
    variables.add(match[1]);
  }

  return variables;
}

/**
 * Extract non-comment variable names from .env.example
 */
function extractEnvExampleVariables(): Set<string> {
  const envExampleContent = readFileSync(ENV_EXAMPLE_PATH, 'utf-8');
  const variables = new Set<string>();

  const lines = envExampleContent.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') {
      continue;
    }

    // Extract variable name from KEY=value or # KEY=value
    const match = trimmed.match(/^#?\s*([A-Z_][A-Z0-9_]*)=/);
    if (match) {
      variables.add(match[1]);
    }
  }

  return variables;
}

/**
 * Main validation logic
 */
function validateEnvExample(): boolean {
  const schemaVars = extractEnvTsVariables();
  const exampleVars = extractEnvExampleVariables();

  // Find variables in schema but not in .env.example
  const missingInExample = [...schemaVars].filter(v => !exampleVars.has(v));

  // Find variables in .env.example but not in schema
  const extraInExample = [...exampleVars].filter(v => !schemaVars.has(v));

  let isValid = true;

  if (missingInExample.length > 0) {
    console.error('❌ ERROR: Variables declared in env.ts but missing from .env.example:');
    missingInExample.forEach(v => console.error(`  - ${v}`));
    isValid = false;
  }

  if (extraInExample.length > 0) {
    console.error('❌ ERROR: Variables in .env.example that are not read by env.ts:');
    extraInExample.forEach(v => console.error(`  - ${v}`));
    isValid = false;
  }

  if (isValid) {
    console.log('✅ SUCCESS: .env.example matches env.ts schema');
    console.log(`   Found ${schemaVars.size} variables`);
  }

  return isValid;
}

// Run validation
const isValid = validateEnvExample();
process.exit(isValid ? 0 : 1);
