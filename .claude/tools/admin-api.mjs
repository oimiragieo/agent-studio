#!/usr/bin/env node
/**
 * Administration API - Enterprise Administration
 * Organization and user management via Claude Administration API
 * Based on: https://docs.claude.com/en/docs/build-with-claude/administration-api.md
 */

const API_BASE_URL = process.env.ANTHROPIC_API_BASE_URL || 'https://api.anthropic.com';

/**
 * Get organization information
 */
export async function getOrganization(orgId) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/v1/organizations/${orgId}`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * List organization members
 */
export async function listOrganizationMembers(orgId) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/v1/organizations/${orgId}/members`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      success: true,
      members: data.members || [],
      total: data.total || 0
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get user information
 */
export async function getUser(userId) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/v1/users/${userId}`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Update user permissions
 */
export async function updateUserPermissions(userId, permissions) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/v1/users/${userId}/permissions`, {
      method: 'PATCH',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ permissions })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get organization settings
 */
export async function getOrganizationSettings(orgId) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  try {
    const response = await fetch(`${API_BASE_URL}/v1/organizations/${orgId}/settings`, {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

export default {
  getOrganization,
  listOrganizationMembers,
  getUser,
  updateUserPermissions,
  getOrganizationSettings
};

