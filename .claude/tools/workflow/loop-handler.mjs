#!/usr/bin/env node
/**
 * Loop Handler - Workflow Loop Iteration Management
 * Manages iterative loops (Story Loop, Epic Loop) in BMad Method workflow
 */

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Initialize loop state
 */
export async function initializeLoop(loopType, context = {}) {
  const loopState = {
    type: loopType,
    current_index: 0,
    total_items: 0,
    items: [],
    started_at: new Date().toISOString(),
    context: context
  };

  // Load items based on loop type
  if (loopType === 'story_loop') {
    loopState.items = await loadStoriesForEpic(context.epic_index, context.epics_stories_path);
    loopState.total_items = loopState.items.length;
  } else if (loopType === 'epic_loop') {
    loopState.items = await loadEpics(context.epics_stories_path);
    loopState.total_items = loopState.items.length;
  }

  return loopState;
}

/**
 * Get current loop item
 */
export function getCurrentItem(loopState) {
  if (!loopState || loopState.current_index >= loopState.total_items) {
    return null;
  }
  return loopState.items[loopState.current_index];
}

/**
 * Advance to next iteration
 */
export function advanceLoop(loopState) {
  if (!loopState) {
    return null;
  }

  loopState.current_index++;
  loopState.updated_at = new Date().toISOString();

  return {
    has_more: loopState.current_index < loopState.total_items,
    current_index: loopState.current_index,
    total_items: loopState.total_items,
    current_item: getCurrentItem(loopState)
  };
}

/**
 * Check if loop has more iterations
 */
export function hasMoreIterations(loopState) {
  if (!loopState) {
    return false;
  }
  return loopState.current_index < loopState.total_items;
}

/**
 * Reset loop to beginning
 */
export function resetLoop(loopState) {
  if (!loopState) {
    return null;
  }

  loopState.current_index = 0;
  loopState.updated_at = new Date().toISOString();

  return loopState;
}

/**
 * Load stories for a specific epic
 */
async function loadStoriesForEpic(epicIndex, epicsStoriesPath) {
  try {
    const epicsStories = await loadArtifact(epicsStoriesPath);
    if (epicsStories && epicsStories.epics && epicsStories.epics[epicIndex]) {
      return epicsStories.epics[epicIndex].stories || [];
    }
  } catch (error) {
    console.error(`Error loading stories for epic ${epicIndex}:`, error);
  }
  return [];
}

/**
 * Load all epics
 */
async function loadEpics(epicsStoriesPath) {
  try {
    const epicsStories = await loadArtifact(epicsStoriesPath);
    if (epicsStories && epicsStories.epics) {
      return epicsStories.epics;
    }
  } catch (error) {
    console.error('Error loading epics:', error);
  }
  return [];
}

/**
 * Load artifact from file
 */
async function loadArtifact(artifactPath) {
  try {
    const content = await readFile(artifactPath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Save loop state to session
 */
export async function saveLoopState(sessionId, loopType, loopState) {
  const statePath = join(process.cwd(), '.claude/context/sessions', `${sessionId}-${loopType}.json`);
  await writeFile(statePath, JSON.stringify(loopState, null, 2), 'utf8');
}

/**
 * Load loop state from session
 */
export async function loadLoopState(sessionId, loopType) {
  const statePath = join(process.cwd(), '.claude/context/sessions', `${sessionId}-${loopType}.json`);
  try {
    const content = await readFile(statePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

export default {
  initializeLoop,
  getCurrentItem,
  advanceLoop,
  hasMoreIterations,
  resetLoop,
  saveLoopState,
  loadLoopState
};

