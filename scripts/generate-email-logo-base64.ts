/**
 * Generate base64-encoded logo for email embedding
 * 
 * Usage:
 *   npx tsx scripts/generate-email-logo-base64.ts
 * 
 * This outputs a data URI that can be pasted directly into email templates
 * for clients that support base64 images (Gmail, Apple Mail, iOS Mail).
 * 
 * Note: Outlook does NOT support base64 images, so use hosted URL for Outlook compatibility.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

function generateBase64Logo(logoPath: string): string {
  const fullPath = resolve(process.cwd(), logoPath);
  const imageBuffer = readFileSync(fullPath);
  const base64 = imageBuffer.toString('base64');
  const mimeType = logoPath.endsWith('.png') ? 'image/png' : 'image/svg+xml';
  
  return `data:${mimeType};base64,${base64}`;
}

// Generate for the new logo
const logoPath = 'public/janet-cares-logo.png';
const dataUri = generateBase64Logo(logoPath);

console.log('\n=== Base64 Data URI (for email templates) ===\n');
console.log(`Logo: ${logoPath}`);
console.log(`\nLength: ${dataUri.length} chars`);
console.log(`\n--- Copy this into your template ---\n`);
console.log(dataUri);
console.log('\n---\n');

// Also generate a version with width/height attributes for reference
console.log('=== HTML img tag example ===\n');
console.log(`<img src="${dataUri.substring(0, 80)}..." alt="Longevity Coach" width="48" height="48" style="display:block;margin:0 auto;border-radius:8px;">`);

console.log('\n=== Recommendation ===');
console.log(`
For maximum compatibility, use a hosted URL approach with fallback:

1. HOSTED URL (Recommended - works everywhere including Outlook):
   <img src="https://yourdomain.com/janet-cares-logo.png" alt="Longevity Coach" width="48" height="48">

2. BASE64 (Works in Gmail, Apple Mail, iOS; NOT Outlook):
   <img src="data:image/png;base64,..." alt="Longevity Coach" width="48" height="48">

For Supabase templates, use Option 1 with your production domain.
`);
