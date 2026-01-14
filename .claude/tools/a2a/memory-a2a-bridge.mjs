/**
 * Memory-A2A Bridge
 *
 * Converts between legacy memory handoff format and A2A Artifact/Part format.
 * Enables interoperability with external A2A agents while maintaining backward compatibility.
 *
 * Features:
 * - Bidirectional conversion: Legacy ↔ A2A
 * - Memory handoff → A2A TextPart
 * - Entity extraction → A2A DataPart
 * - Feature flag integration
 * - Performance optimized (<200ms handoff preparation)
 *
 * @module memory-a2a-bridge
 */

import { randomUUID } from 'crypto';

/**
 * Feature flags for A2A memory bridge
 */
const FEATURE_FLAGS = {
  memory_a2a_bridge: process.env.MEMORY_A2A_BRIDGE === 'true' || false,
};

/**
 * Memory-A2A Bridge
 *
 * Converts memory handoff format to/from A2A Artifact format
 */
export class MemoryA2ABridge {
  /**
   * @param {object} options - Configuration options
   */
  constructor(options = {}) {
    this.memoryHandoffService = options.memoryHandoffService;
    this.entityConverter = options.entityConverter;
    this.featureFlags = options.featureFlags || FEATURE_FLAGS;
  }

  /**
   * Convert legacy memory handoff to A2A Artifact
   *
   * @param {object} handoff - Legacy memory handoff object
   * @returns {Promise<object>} A2A Artifact
   */
  async toA2AArtifact(handoff) {
    const startTime = Date.now();

    if (!this.featureFlags.memory_a2a_bridge) {
      throw new Error('memory_a2a_bridge feature flag is disabled');
    }

    // Validate input
    if (!handoff || !handoff.memories) {
      throw new Error('Invalid handoff: memories required');
    }

    // Convert memories to TextPart
    const memoryParts = await this.convertMemoriesToParts(handoff.memories);

    // Convert entities to DataPart (if present)
    const entityParts =
      handoff.entities && handoff.entities.length > 0
        ? [await this.convertEntitiesToDataPart(handoff.entities)]
        : [];

    // Build A2A Artifact
    const artifact = {
      artifactId: handoff.handoffId || `artifact-handoff-${randomUUID()}`,
      name: 'memory-handoff',
      parts: [...memoryParts, ...entityParts],
      metadata: {
        relevanceScore: handoff.relevanceScore || 0,
        tokenBudget: handoff.tokenBudget || 0,
        sourceAgentId: handoff.sourceAgentId,
        targetAgentId: handoff.targetAgentId,
        conversionDuration: Date.now() - startTime,
        format: 'a2a',
        version: '1.0.0',
      },
    };

    console.log(
      `[Memory-A2A Bridge] Converted handoff to A2A Artifact in ${Date.now() - startTime}ms`
    );

    return artifact;
  }

  /**
   * Convert A2A Artifact to legacy memory handoff
   *
   * @param {object} artifact - A2A Artifact
   * @returns {Promise<object>} Legacy memory handoff
   */
  async fromA2AArtifact(artifact) {
    const startTime = Date.now();

    if (!this.featureFlags.memory_a2a_bridge) {
      throw new Error('memory_a2a_bridge feature flag is disabled');
    }

    // Validate input
    if (!artifact || !artifact.parts || !Array.isArray(artifact.parts)) {
      throw new Error('Invalid artifact: parts array required');
    }

    // Extract TextParts → memories
    const memories = await this.convertPartsToMemories(artifact.parts.filter(p => p.text));

    // Extract DataParts → entities
    const entities = await this.convertDataPartToEntities(
      artifact.parts.find(p => p.data && p.data.entities)
    );

    // Build legacy handoff
    const handoff = {
      handoffId: artifact.artifactId,
      memories,
      entities: entities || [],
      relevanceScore: artifact.metadata?.relevanceScore || 0,
      tokenBudget: artifact.metadata?.tokenBudget || 0,
      sourceAgentId: artifact.metadata?.sourceAgentId,
      targetAgentId: artifact.metadata?.targetAgentId,
      metadata: {
        conversionDuration: Date.now() - startTime,
        originalFormat: artifact.metadata?.format || 'a2a',
      },
    };

    console.log(
      `[Memory-A2A Bridge] Converted A2A Artifact to legacy handoff in ${Date.now() - startTime}ms`
    );

    return handoff;
  }

  /**
   * Convert memories to A2A TextParts
   *
   * @param {Array} memories - Memory objects
   * @returns {Promise<Array>} A2A TextParts
   */
  async convertMemoriesToParts(memories) {
    const startTime = Date.now();

    if (!Array.isArray(memories)) {
      throw new Error('Memories must be an array');
    }

    // Group memories by tier for better organization
    const textContent = memories
      .map(memory => {
        const roleLabel = memory.role || 'unknown';
        const timestamp = memory.timestamp ? new Date(memory.timestamp).toISOString() : 'unknown';
        const tier = memory.tier || 'conversation';
        const relevance = memory.relevanceScore
          ? `relevance: ${memory.relevanceScore.toFixed(2)}`
          : '';

        return `[${roleLabel}] [${tier}] [${timestamp}] ${relevance}\n${memory.content}`;
      })
      .join('\n\n---\n\n');

    const duration = Date.now() - startTime;

    console.log(
      `[Memory-A2A Bridge] Converted ${memories.length} memories to TextPart in ${duration}ms`
    );

    return [
      {
        text: textContent,
      },
    ];
  }

  /**
   * Convert entities to A2A DataPart
   *
   * @param {Array} entities - Entity objects
   * @returns {Promise<object>} A2A DataPart
   */
  async convertEntitiesToDataPart(entities) {
    const startTime = Date.now();

    if (!Array.isArray(entities)) {
      throw new Error('Entities must be an array');
    }

    // Use EntityA2AConverter if available
    if (this.entityConverter) {
      return await this.entityConverter.toA2ADataPart(entities);
    }

    // Fallback: basic conversion
    const dataPart = {
      data: {
        entities: entities.map(entity => ({
          entityId: entity.entityId || entity.id,
          entityType: entity.entityType || entity.type,
          name: entity.name || entity.value,
          attributes: entity.attributes || {},
          relationships: entity.relationships || [],
          mentions: entity.mentions || entity.occurrence_count || 1,
        })),
      },
    };

    const duration = Date.now() - startTime;

    console.log(
      `[Memory-A2A Bridge] Converted ${entities.length} entities to DataPart in ${duration}ms`
    );

    return dataPart;
  }

  /**
   * Convert A2A TextParts to memories
   *
   * @param {Array} parts - A2A TextParts
   * @returns {Promise<Array>} Memory objects
   */
  async convertPartsToMemories(parts) {
    const startTime = Date.now();

    if (!Array.isArray(parts)) {
      throw new Error('Parts must be an array');
    }

    const memories = [];

    for (const part of parts) {
      if (!part.text) {
        continue;
      }

      // Parse structured text back into memory objects
      const sections = part.text.split('\n\n---\n\n');

      for (const section of sections) {
        const match = section.match(
          /^\[([^\]]+)\] \[([^\]]+)\] \[([^\]]+)\] ?(relevance: ([0-9.]+))?\n(.+)$/s
        );

        if (match) {
          const [, role, tier, timestamp, , relevanceScore, content] = match;

          memories.push({
            role,
            tier,
            timestamp,
            relevanceScore: relevanceScore ? parseFloat(relevanceScore) : undefined,
            content: content.trim(),
          });
        } else {
          // Fallback: treat as plain text memory
          memories.push({
            role: 'unknown',
            tier: 'conversation',
            timestamp: new Date().toISOString(),
            content: section.trim(),
          });
        }
      }
    }

    const duration = Date.now() - startTime;

    console.log(
      `[Memory-A2A Bridge] Converted ${parts.length} TextParts to ${memories.length} memories in ${duration}ms`
    );

    return memories;
  }

  /**
   * Convert A2A DataPart to entities
   *
   * @param {object} dataPart - A2A DataPart
   * @returns {Promise<Array>} Entity objects
   */
  async convertDataPartToEntities(dataPart) {
    const startTime = Date.now();

    if (!dataPart || !dataPart.data) {
      return [];
    }

    // Use EntityA2AConverter if available
    if (this.entityConverter) {
      return await this.entityConverter.fromA2ADataPart(dataPart);
    }

    // Fallback: basic conversion
    const entities = (dataPart.data.entities || []).map(entity => ({
      id: entity.entityId,
      type: entity.entityType,
      value: entity.name,
      attributes: entity.attributes || {},
      relationships: entity.relationships || [],
      occurrence_count: entity.mentions || 1,
    }));

    const duration = Date.now() - startTime;

    console.log(
      `[Memory-A2A Bridge] Converted DataPart to ${entities.length} entities in ${duration}ms`
    );

    return entities;
  }

  /**
   * Prepare handoff in A2A format
   *
   * Wrapper around memoryHandoffService.prepareHandoff that converts to A2A
   *
   * @param {object} params - Handoff parameters
   * @returns {Promise<object>} A2A Artifact
   */
  async prepareA2AHandoff(params) {
    if (!this.memoryHandoffService) {
      throw new Error('memoryHandoffService not configured');
    }

    if (!this.featureFlags.memory_a2a_bridge) {
      throw new Error('memory_a2a_bridge feature flag is disabled');
    }

    // Prepare handoff using existing service
    const handoff = await this.memoryHandoffService.prepareHandoff(params);

    // Convert to A2A format
    const artifact = await this.toA2AArtifact({
      handoffId: handoff.handoffId,
      memories: handoff.context?.memories || [],
      entities: handoff.context?.entities || [],
      relevanceScore: handoff.metadata?.relevanceScore,
      tokenBudget: handoff.metadata?.tokenBudget,
      sourceAgentId: params.sourceAgentId,
      targetAgentId: params.targetAgentId,
    });

    return artifact;
  }

  /**
   * Apply A2A handoff context
   *
   * Converts A2A Artifact to legacy format and applies via memoryHandoffService
   *
   * @param {object} artifact - A2A Artifact
   * @returns {Promise<object>} Applied handoff result
   */
  async applyA2AHandoff(artifact) {
    if (!this.memoryHandoffService) {
      throw new Error('memoryHandoffService not configured');
    }

    if (!this.featureFlags.memory_a2a_bridge) {
      throw new Error('memory_a2a_bridge feature flag is disabled');
    }

    // Convert from A2A format
    const handoff = await this.fromA2AArtifact(artifact);

    // Apply handoff using existing service
    const result = await this.memoryHandoffService.applyHandoffContext(handoff.handoffId);

    return {
      ...result,
      handoff,
    };
  }
}

/**
 * Create Memory-A2A Bridge
 *
 * @param {object} options - Configuration options
 * @returns {MemoryA2ABridge}
 */
export function createMemoryA2ABridge(options = {}) {
  return new MemoryA2ABridge(options);
}
