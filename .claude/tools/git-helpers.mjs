#!/usr/bin/env node
/**
 * Cross-platform Git Helper Utilities
 *
 * Provides Windows-compatible git operations without relying on Unix tools
 * (grep, awk, sed) which are not available in cmd/PowerShell.
 *
 * Usage:
 *   import { getRemoteUrl, getCurrentBranch, getRepoName } from './git-helpers.mjs';
 *
 *   const url = getRemoteUrl('origin');
 *   const branch = getCurrentBranch();
 *   const repo = getRepoName();
 *
 * @module git-helpers
 * @version 1.0.0
 */

import { execSync } from 'child_process';

/**
 * Get the URL for a git remote
 * @param {string} remoteName - Name of the remote (default: 'origin')
 * @returns {string} - Remote URL
 * @throws {Error} - If remote not found or git command fails
 */
export function getRemoteUrl(remoteName = 'origin') {
  try {
    return execSync(`git remote get-url ${remoteName}`, {
      encoding: 'utf-8',
    }).trim();
  } catch (error) {
    throw new Error(`Failed to get remote URL for '${remoteName}': ${error.message}`);
  }
}

/**
 * Get the current git branch name
 * @returns {string} - Current branch name
 * @throws {Error} - If not in a git repository or git command fails
 */
export function getCurrentBranch() {
  try {
    return execSync('git branch --show-current', {
      encoding: 'utf-8',
    }).trim();
  } catch (error) {
    throw new Error(`Failed to get current branch: ${error.message}`);
  }
}

/**
 * Get the repository name from remote URL
 * Supports both HTTPS and SSH URLs
 * @param {string} remoteName - Name of the remote (default: 'origin')
 * @returns {string|null} - Repository name (e.g., 'user/repo') or null if parsing fails
 */
export function getRepoName(remoteName = 'origin') {
  try {
    const url = getRemoteUrl(remoteName);

    // Extract repo name from URL (works with both HTTPS and SSH)
    // Examples:
    // - https://github.com/user/repo.git → user/repo
    // - git@github.com:user/repo.git → user/repo
    const match = url.match(/[:/]([^/]+\/[^/]+?)(\.git)?$/);
    return match ? match[1] : null;
  } catch (error) {
    throw new Error(`Failed to get repository name: ${error.message}`);
  }
}

/**
 * Get all remotes and their URLs
 * @returns {Object[]} - Array of { name, url } objects
 */
export function getAllRemotes() {
  try {
    const output = execSync('git remote -v', { encoding: 'utf-8' });
    const lines = output.split('\n').filter(line => line.trim());

    // Parse each line: "origin https://github.com/user/repo.git (fetch)"
    const remotes = {};
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        const name = parts[0];
        const url = parts[1];
        if (!remotes[name]) {
          remotes[name] = url;
        }
      }
    }

    return Object.entries(remotes).map(([name, url]) => ({ name, url }));
  } catch (error) {
    throw new Error(`Failed to get remotes: ${error.message}`);
  }
}

/**
 * Check if the current directory is a git repository
 * @returns {boolean} - True if inside a git repository
 */
export function isGitRepo() {
  try {
    execSync('git rev-parse --git-dir', { encoding: 'utf-8', stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get the default branch name (usually 'main' or 'master')
 * @param {string} remoteName - Name of the remote (default: 'origin')
 * @returns {string} - Default branch name
 * @throws {Error} - If remote not found or git command fails
 */
export function getDefaultBranch(remoteName = 'origin') {
  try {
    const output = execSync(`git remote show ${remoteName}`, { encoding: 'utf-8' });

    // Parse output to find "HEAD branch: <branch>"
    const match = output.match(/HEAD branch:\s+(\S+)/);
    return match ? match[1] : 'main';
  } catch (error) {
    // Fallback to 'main' if command fails
    console.warn(`Could not determine default branch, falling back to 'main': ${error.message}`);
    return 'main';
  }
}

/**
 * Get the list of changed files (both staged and unstaged)
 * @returns {string[]} - Array of changed file paths
 */
export function getChangedFiles() {
  try {
    const output = execSync('git status --porcelain', { encoding: 'utf-8' });
    const lines = output.split('\n').filter(line => line.trim());

    // Parse status output: "MM file.txt" or " M file.txt" or "?? file.txt"
    return lines.map(line => {
      const parts = line.split(/\s+/);
      return parts[parts.length - 1];
    });
  } catch (error) {
    throw new Error(`Failed to get changed files: ${error.message}`);
  }
}

/**
 * Get the commit hash of the current HEAD
 * @param {boolean} short - Return short hash (default: false)
 * @returns {string} - Commit hash
 */
export function getCurrentCommit(short = false) {
  try {
    const format = short ? '--short' : '';
    return execSync(`git rev-parse ${format} HEAD`, { encoding: 'utf-8' }).trim();
  } catch (error) {
    throw new Error(`Failed to get current commit: ${error.message}`);
  }
}

/**
 * Check if the working directory is clean (no uncommitted changes)
 * @returns {boolean} - True if working directory is clean
 */
export function isWorkingDirectoryClean() {
  try {
    const output = execSync('git status --porcelain', { encoding: 'utf-8' });
    return output.trim() === '';
  } catch (error) {
    throw new Error(`Failed to check working directory status: ${error.message}`);
  }
}

/**
 * Get the list of files in the last commit
 * @returns {string[]} - Array of file paths
 */
export function getLastCommitFiles() {
  try {
    const output = execSync('git diff-tree --no-commit-id --name-only -r HEAD', {
      encoding: 'utf-8',
    });
    return output.split('\n').filter(line => line.trim());
  } catch (error) {
    throw new Error(`Failed to get last commit files: ${error.message}`);
  }
}

/**
 * Get the number of commits ahead of remote
 * @param {string} remoteName - Name of the remote (default: 'origin')
 * @returns {number} - Number of commits ahead
 */
export function getCommitsAhead(remoteName = 'origin') {
  try {
    const branch = getCurrentBranch();
    const output = execSync(`git rev-list --count ${remoteName}/${branch}..HEAD`, {
      encoding: 'utf-8',
    });
    return parseInt(output.trim(), 10);
  } catch (error) {
    // If remote branch doesn't exist, return 0
    return 0;
  }
}

/**
 * Get the number of commits behind remote
 * @param {string} remoteName - Name of the remote (default: 'origin')
 * @returns {number} - Number of commits behind
 */
export function getCommitsBehind(remoteName = 'origin') {
  try {
    const branch = getCurrentBranch();
    const output = execSync(`git rev-list --count HEAD..${remoteName}/${branch}`, {
      encoding: 'utf-8',
    });
    return parseInt(output.trim(), 10);
  } catch (error) {
    // If remote branch doesn't exist, return 0
    return 0;
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  try {
    if (command === 'remote-url') {
      const remoteName = process.argv[3] || 'origin';
      console.log(getRemoteUrl(remoteName));
    } else if (command === 'current-branch') {
      console.log(getCurrentBranch());
    } else if (command === 'repo-name') {
      const remoteName = process.argv[3] || 'origin';
      console.log(getRepoName(remoteName));
    } else if (command === 'all-remotes') {
      console.log(JSON.stringify(getAllRemotes(), null, 2));
    } else if (command === 'is-repo') {
      console.log(isGitRepo() ? 'yes' : 'no');
    } else if (command === 'default-branch') {
      const remoteName = process.argv[3] || 'origin';
      console.log(getDefaultBranch(remoteName));
    } else if (command === 'changed-files') {
      console.log(getChangedFiles().join('\n'));
    } else if (command === 'current-commit') {
      const short = process.argv[3] === '--short';
      console.log(getCurrentCommit(short));
    } else if (command === 'is-clean') {
      console.log(isWorkingDirectoryClean() ? 'yes' : 'no');
    } else if (command === 'last-commit-files') {
      console.log(getLastCommitFiles().join('\n'));
    } else if (command === 'commits-ahead') {
      const remoteName = process.argv[3] || 'origin';
      console.log(getCommitsAhead(remoteName));
    } else if (command === 'commits-behind') {
      const remoteName = process.argv[3] || 'origin';
      console.log(getCommitsBehind(remoteName));
    } else {
      console.log('Usage:');
      console.log('  node git-helpers.mjs remote-url [remote]');
      console.log('  node git-helpers.mjs current-branch');
      console.log('  node git-helpers.mjs repo-name [remote]');
      console.log('  node git-helpers.mjs all-remotes');
      console.log('  node git-helpers.mjs is-repo');
      console.log('  node git-helpers.mjs default-branch [remote]');
      console.log('  node git-helpers.mjs changed-files');
      console.log('  node git-helpers.mjs current-commit [--short]');
      console.log('  node git-helpers.mjs is-clean');
      console.log('  node git-helpers.mjs last-commit-files');
      console.log('  node git-helpers.mjs commits-ahead [remote]');
      console.log('  node git-helpers.mjs commits-behind [remote]');
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Export all functions
export default {
  getRemoteUrl,
  getCurrentBranch,
  getRepoName,
  getAllRemotes,
  isGitRepo,
  getDefaultBranch,
  getChangedFiles,
  getCurrentCommit,
  isWorkingDirectoryClean,
  getLastCommitFiles,
  getCommitsAhead,
  getCommitsBehind,
};
