/**
 * @file .claude/lib/observability/telemetry-client.cjs
 * @description OpenTelemetry SDK initialization client with lazy loading
 *
 * Provides telemetry initialization, tracer access, and graceful shutdown.
 * Implements lazy initialization pattern - only initializes when init() is called
 * and OTEL_ENABLED=true.
 *
 * Environment Variables:
 * - OTEL_ENABLED: Enable/disable OpenTelemetry (true|false, default: false)
 * - OTEL_EXPORTER_OTLP_ENDPOINT: OTLP endpoint (default: http://localhost:4317)
 * - OTEL_BATCH_SIZE: Max spans per batch (default: 512)
 * - OTEL_BATCH_TIMEOUT: Batch interval in ms (default: 5000)
 * - AGENT_STUDIO_ENV: Environment name (development|staging|production, default: development)
 *
 * Task: #41 (P1-6.1), #42 (P1-6.2)
 * Date: 2026-01-29
 */

const { NodeSDK } = require('@opentelemetry/sdk-node');
const { BatchSpanProcessor } = require('@opentelemetry/sdk-trace-base');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-grpc');
const { resourceFromAttributes } = require('@opentelemetry/resources');
const {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} = require('@opentelemetry/semantic-conventions');
const { trace } = require('@opentelemetry/api');

// Singleton state
let initialized = false;
let sdk = null;
let tracer = null;
let batchProcessorConfig = null;

/**
 * Check if OpenTelemetry is enabled via environment variable
 * @returns {boolean} True if OTEL_ENABLED is 'true'
 */
function isEnabled() {
  return process.env.OTEL_ENABLED === 'true';
}

/**
 * Get OTLP endpoint from environment or default
 * @returns {string} OTLP endpoint URL
 */
function getEndpoint() {
  return process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';
}

/**
 * Get batch processor configuration from environment or defaults
 * @returns {{maxQueueSize: number, maxExportBatchSize: number, scheduledDelayMillis: number, exportTimeoutMillis: number}}
 */
function getBatchProcessorConfig() {
  const batchSize = parseInt(process.env.OTEL_BATCH_SIZE || '512', 10);
  const batchTimeout = parseInt(process.env.OTEL_BATCH_TIMEOUT || '5000', 10);

  return {
    maxQueueSize: 2048, // Fixed (not configurable via env)
    maxExportBatchSize: isNaN(batchSize) ? 512 : batchSize,
    scheduledDelayMillis: isNaN(batchTimeout) ? 5000 : batchTimeout,
    exportTimeoutMillis: 30000, // Fixed (not configurable via env)
  };
}

/**
 * Get resource attributes for service identification
 * @returns {ResourceImpl} OpenTelemetry resource
 */
function getResource() {
  const environment = process.env.AGENT_STUDIO_ENV || 'development';

  return resourceFromAttributes({
    [ATTR_SERVICE_NAME]: 'agent-studio',
    [ATTR_SERVICE_VERSION]: '2.2.1',
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
  });
}

/**
 * Initialize OpenTelemetry SDK with lazy loading
 *
 * Only initializes if:
 * - OTEL_ENABLED=true
 * - Not already initialized
 *
 * Returns initialization status with metadata including BatchSpanProcessor configuration.
 *
 * @returns {Promise<{initialized: boolean, enabled: boolean, endpoint?: string, resource?: object, batchProcessor?: object, reason?: string, alreadyInitialized?: boolean, error?: string}>}
 */
async function init() {
  // Check if enabled
  if (!isEnabled()) {
    return {
      initialized: false,
      enabled: false,
      reason: 'OTEL_ENABLED is false',
    };
  }

  // Check if already initialized
  if (initialized) {
    const endpoint = getEndpoint();
    const resource = getResource();

    return {
      initialized: true,
      enabled: true,
      endpoint,
      resource: resource.attributes,
      batchProcessor: batchProcessorConfig,
      alreadyInitialized: true,
    };
  }

  const endpoint = getEndpoint();
  const resource = getResource();
  batchProcessorConfig = getBatchProcessorConfig();

  try {
    // Create OTLP exporter
    const traceExporter = new OTLPTraceExporter({
      url: endpoint,
      headers: {}, // No auth for self-hosted Phoenix
    });

    // Create BatchSpanProcessor with configuration
    const spanProcessor = new BatchSpanProcessor(traceExporter, {
      maxQueueSize: batchProcessorConfig.maxQueueSize,
      maxExportBatchSize: batchProcessorConfig.maxExportBatchSize,
      scheduledDelayMillis: batchProcessorConfig.scheduledDelayMillis,
      exportTimeoutMillis: batchProcessorConfig.exportTimeoutMillis,
    });

    // Create NodeSDK with BatchSpanProcessor and resource
    sdk = new NodeSDK({
      resource,
      spanProcessor, // Use custom BatchSpanProcessor instead of default
    });

    // Start the SDK
    await sdk.start();

    // Get default tracer
    tracer = trace.getTracer('agent-studio', '2.2.1');

    initialized = true;

    // Add type for test assertions
    batchProcessorConfig.type = 'BatchSpanProcessor';

    return {
      initialized: true,
      enabled: true,
      endpoint,
      resource: resource.attributes,
      batchProcessor: batchProcessorConfig,
    };
  } catch (error) {
    // Log error but don't crash - graceful degradation
    console.error('[OpenTelemetry] Initialization failed:', error.message);

    return {
      initialized: false,
      enabled: true,
      endpoint,
      error: error.message,
    };
  }
}

/**
 * Get tracer instance
 *
 * Returns:
 * - Real tracer if initialized
 * - No-op tracer if not initialized (graceful degradation)
 *
 * @returns {object} OpenTelemetry tracer
 */
function getTracer() {
  if (initialized && tracer) {
    return tracer;
  }

  // Return no-op tracer from global API (graceful degradation)
  return trace.getTracer('agent-studio-noop', '2.2.1');
}

/**
 * Shutdown OpenTelemetry SDK gracefully
 *
 * Flushes pending spans and cleans up resources.
 *
 * @returns {Promise<{success: boolean, message?: string}>}
 */
async function shutdown() {
  if (!initialized || !sdk) {
    return {
      success: true,
      message: 'Not initialized, nothing to shutdown',
    };
  }

  try {
    await sdk.shutdown();
    initialized = false;
    sdk = null;
    tracer = null;
    batchProcessorConfig = null;

    return {
      success: true,
      message: 'OpenTelemetry shutdown successfully',
    };
  } catch (error) {
    console.error('[OpenTelemetry] Shutdown failed:', error.message);

    return {
      success: false,
      message: error.message,
    };
  }
}

/**
 * Configure tracer with advanced options (optional, for future extensions)
 *
 * Allows custom exporter or processor configuration.
 *
 * @param {{exporter?: object}} options - Configuration options
 * @returns {{exporter: object}} Current configuration
 */
function configureTracer(options = {}) {
  return {
    exporter: options.exporter || null,
  };
}

module.exports = {
  init,
  getTracer,
  shutdown,
  configureTracer,
};
