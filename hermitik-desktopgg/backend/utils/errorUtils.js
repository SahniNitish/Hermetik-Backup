/**
 * Shared Error Handling Utilities
 * Provides consistent error handling patterns across the application
 */

const { AppError } = require('../middleware/errorHandler');

class ErrorUtils {
  /**
   * Standardized async function wrapper with error handling and operation tracking
   * @param {Function} fn - Async function to wrap
   * @param {Object} options - Options for error handling
   * @param {string} options.operation - Operation name for logging
   * @param {boolean} options.rethrow - Whether to rethrow errors (default: true)
   * @param {Function} options.onError - Custom error handler
   * @param {any} options.fallback - Fallback value to return on error
   * @returns {Function} Wrapped function
   */
  static wrapAsync(fn, options = {}) {
    const {
      operation = 'unknown',
      rethrow = true,
      onError = null,
      fallback = null
    } = options;

    return async (...args) => {
      const operationId = `${operation}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const startTime = Date.now();

      try {
        console.log(`🚀 [${operationId}] Starting operation: ${operation}`);
        
        const result = await fn(...args);
        const duration = Date.now() - startTime;
        
        console.log(`✅ [${operationId}] Operation completed successfully in ${duration}ms`);
        return result;
        
      } catch (error) {
        const duration = Date.now() - startTime;
        
        const errorInfo = {
          operationId,
          operation,
          duration,
          message: error.message,
          stack: error.stack,
          args: args.length > 0 ? this.sanitizeArgs(args) : undefined
        };

        console.error(`❌ [${operationId}] Operation failed after ${duration}ms:`, errorInfo);

        // Call custom error handler if provided
        if (onError) {
          try {
            await onError(error, errorInfo);
          } catch (handlerError) {
            console.error(`❌ [${operationId}] Error handler failed:`, handlerError.message);
          }
        }

        // Return fallback value if provided and not rethrowing
        if (!rethrow && fallback !== null) {
          console.log(`🔄 [${operationId}] Returning fallback value`);
          return fallback;
        }

        // Enhance error with operation context
        if (error instanceof AppError) {
          throw error; // Don't wrap AppErrors
        }

        const enhancedError = new AppError(
          `Operation '${operation}' failed: ${error.message}`,
          error.statusCode || 500
        );
        enhancedError.operationId = operationId;
        enhancedError.originalError = error;

        if (rethrow) {
          throw enhancedError;
        }

        return fallback;
      }
    };
  }

  /**
   * Standardized database operation wrapper
   * @param {Function} dbOperation - Database operation function
   * @param {string} operationName - Name of the operation
   * @param {Object} context - Additional context for logging
   * @returns {Promise<any>} Operation result
   */
  static async wrapDatabaseOperation(dbOperation, operationName, context = {}) {
    return this.wrapAsync(dbOperation, {
      operation: `db-${operationName}`,
      onError: async (error, errorInfo) => {
        // Log database-specific error details
        console.error(`💾 Database operation failed:`, {
          ...errorInfo,
          context,
          isDuplicateKey: error.code === 11000,
          isValidationError: error.name === 'ValidationError',
          isConnectionError: error.name === 'MongoNetworkError'
        });
      }
    })();
  }

  /**
   * Standardized external API operation wrapper
   * @param {Function} apiOperation - API operation function
   * @param {string} operationName - Name of the operation
   * @param {Object} context - Additional context for logging
   * @returns {Promise<any>} Operation result
   */
  static async wrapApiOperation(apiOperation, operationName, context = {}) {
    return this.wrapAsync(apiOperation, {
      operation: `api-${operationName}`,
      onError: async (error, errorInfo) => {
        // Log API-specific error details
        console.error(`🌐 External API operation failed:`, {
          ...errorInfo,
          context,
          statusCode: error.statusCode || error.response?.status,
          isTimeout: error.code === 'ECONNABORTED',
          isNetworkError: !error.response
        });
      }
    })();
  }

  /**
   * Creates a retry wrapper for operations that may fail temporarily
   * @param {Function} operation - Operation to retry
   * @param {Object} options - Retry options
   * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
   * @param {number} options.baseDelay - Base delay between retries in ms (default: 1000)
   * @param {Function} options.shouldRetry - Function to determine if error should be retried
   * @returns {Function} Wrapped function with retry logic
   */
  static withRetry(operation, options = {}) {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      shouldRetry = (error) => !error.statusCode || error.statusCode >= 500
    } = options;

    return this.wrapAsync(async (...args) => {
      let lastError;
      
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await operation(...args);
        } catch (error) {
          lastError = error;
          
          if (attempt === maxRetries || !shouldRetry(error)) {
            throw error;
          }
          
          const delay = baseDelay * Math.pow(2, attempt); // Exponential backoff
          console.log(`🔄 Retrying operation in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
          await this.sleep(delay);
        }
      }
      
      throw lastError;
    }, {
      operation: 'retry-wrapper'
    });
  }

  /**
   * Standardized batch operation processor with error handling
   * @param {Array} items - Items to process
   * @param {Function} processor - Function to process each item
   * @param {Object} options - Processing options
   * @param {number} options.batchSize - Number of items to process concurrently
   * @param {boolean} options.continueOnError - Whether to continue processing on individual errors
   * @returns {Promise<Object>} Results object with successful and failed items
   */
  static async processBatch(items, processor, options = {}) {
    const {
      batchSize = 5,
      continueOnError = true
    } = options;

    const results = {
      successful: [],
      failed: [],
      totalItems: items.length
    };

    const wrappedProcessor = this.wrapAsync(processor, {
      operation: 'batch-item',
      rethrow: !continueOnError
    });

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      console.log(`📦 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`);

      const batchPromises = batch.map(async (item, index) => {
        try {
          const result = await wrappedProcessor(item, i + index);
          results.successful.push({ item, result, index: i + index });
        } catch (error) {
          results.failed.push({ item, error, index: i + index });
          
          if (!continueOnError) {
            throw error;
          }
        }
      });

      if (continueOnError) {
        await Promise.allSettled(batchPromises);
      } else {
        await Promise.all(batchPromises);
      }
    }

    console.log(`📊 Batch processing complete: ${results.successful.length} successful, ${results.failed.length} failed`);
    return results;
  }

  /**
   * Sanitizes function arguments for logging (removes sensitive data)
   * @param {Array} args - Function arguments
   * @returns {Array} Sanitized arguments
   */
  static sanitizeArgs(args) {
    return args.map((arg, index) => {
      if (typeof arg === 'string' && arg.length > 100) {
        return `${arg.substring(0, 100)}... (truncated)`;
      }
      
      if (typeof arg === 'object' && arg !== null) {
        const sanitized = { ...arg };
        
        // Remove sensitive fields
        const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth'];
        sensitiveFields.forEach(field => {
          if (sanitized[field]) {
            sanitized[field] = '[REDACTED]';
          }
        });
        
        return sanitized;
      }
      
      return arg;
    });
  }

  /**
   * Utility method to sleep for a specified duration
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  static sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Creates a circuit breaker for operations that may fail frequently
   * @param {Function} operation - Operation to wrap
   * @param {Object} options - Circuit breaker options
   * @returns {Function} Wrapped function with circuit breaker
   */
  static withCircuitBreaker(operation, options = {}) {
    const {
      failureThreshold = 5,
      resetTimeout = 60000,
      monitorWindow = 300000 // 5 minutes
    } = options;

    let failures = 0;
    let lastFailureTime = 0;
    let state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN

    return this.wrapAsync(async (...args) => {
      const now = Date.now();

      // Reset failure count if monitor window has passed
      if (now - lastFailureTime > monitorWindow) {
        failures = 0;
      }

      // Check circuit breaker state
      if (state === 'OPEN') {
        if (now - lastFailureTime > resetTimeout) {
          state = 'HALF_OPEN';
          console.log(`🔄 Circuit breaker transitioning to HALF_OPEN`);
        } else {
          throw new AppError('Circuit breaker is OPEN - operation not allowed', 503);
        }
      }

      try {
        const result = await operation(...args);
        
        // Reset on success
        if (state === 'HALF_OPEN') {
          state = 'CLOSED';
          failures = 0;
          console.log(`✅ Circuit breaker reset to CLOSED`);
        }
        
        return result;
        
      } catch (error) {
        failures++;
        lastFailureTime = now;

        if (failures >= failureThreshold) {
          state = 'OPEN';
          console.error(`⚠️ Circuit breaker OPENED after ${failures} failures`);
        }

        throw error;
      }
    }, {
      operation: 'circuit-breaker'
    });
  }
}

module.exports = ErrorUtils;