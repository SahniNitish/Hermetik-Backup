/**
 * Standardized API Response Formatter
 * Ensures consistent response format across all endpoints
 */

class ApiResponse {
  /**
   * Success response format
   * @param {*} data - Response data
   * @param {string} message - Success message
   * @param {number} code - HTTP status code
   */
  static success(data = null, message = 'Success', code = 200) {
    return {
      success: true,
      code,
      message,
      data,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Error response format
   * @param {string} message - Error message
   * @param {number} code - HTTP status code
   * @param {*} details - Error details
   */
  static error(message = 'Internal Server Error', code = 500, details = null) {
    return {
      success: false,
      code,
      message,
      error: details,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Validation error response
   * @param {Array} errors - Validation errors
   * @param {string} message - Error message
   */
  static validationError(errors, message = 'Validation failed') {
    return {
      success: false,
      code: 400,
      message,
      errors,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Paginated response format
   * @param {Array} data - Response data
   * @param {number} total - Total count
   * @param {number} page - Current page
   * @param {number} limit - Items per page
   * @param {string} message - Success message
   */
  static paginated(data, total, page, limit, message = 'Success') {
    return {
      success: true,
      code: 200,
      message,
      data,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit)
      },
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = ApiResponse;