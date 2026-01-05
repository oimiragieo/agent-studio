#!/usr/bin/env node
/**
 * Settings Reader - Reads settings from settings.json
 * 
 * Provides readSettings() function for tools that need to access settings
 * 
 * Usage:
 *   import { readSettings } from './settings.mjs';
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Read settings from settings.json
 * @returns {Object} Settings object
 */
export function readSettings() {
  const settingsPath = join(__dirname, 'settings.json');
  try {
    const content = readFileSync(settingsPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    // Return default settings if file doesn't exist
    console.warn(`Warning: Could not read settings.json: ${error.message}. Using defaults.`);
    return {
      session: {
        max_context_tokens: 100000
      }
    };
  }
}

export default {
  readSettings
};

