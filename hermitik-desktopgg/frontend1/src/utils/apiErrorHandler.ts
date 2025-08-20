/**
 * Comprehensive API Error Handling Utilities
 * Handles network errors, API errors, and provides user-friendly messages
 */

export interface ApiError {
  success: false;
  code: number;
  message: string;
  error?: any;
  timestamp?: string;
}

export interface ApiSuccess<T = any> {
  success: true;
  code: number;
  message: string;
  data: T;
  timestamp?: string;
}

export type ApiResponse<T = any> = ApiSuccess<T> | ApiError;

export class NetworkError extends Error {
  constructor(message: string = 'Network connection failed') {
    super(message);
    this.name = 'NetworkError';
  }
}

export class ApiResponseError extends Error {
  public code: number;
  public details?: any;

  constructor(message: string, code: number, details?: any) {
    super(message);
    this.name = 'ApiResponseError';
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends Error {
  public errors: string[];

  constructor(message: string, errors: string[] = []) {
    super(message);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Handles different types of API errors and provides user-friendly messages
 */
export const handleApiError = (error: any): string => {
  console.error('API Error:', error);

  // Network errors (no response from server)
  if (!error.response) {
    if (error.code === 'ECONNABORTED') {
      return 'Request timeout. Please check your connection and try again.';
    }
    if (error.code === 'ERR_NETWORK') {
      return 'Network error. Please check your internet connection.';
    }
    return 'Unable to connect to server. Please try again later.';
  }

  // Server responded with error status
  const { status, data } = error.response;

  // Handle standardized API error responses
  if (data && typeof data === 'object') {
    if (data.message) {
      return data.message;
    }
    if (data.error && typeof data.error === 'string') {
      return data.error;
    }
  }

  // HTTP status code based messages
  switch (status) {
    case 400:
      return 'Invalid request. Please check your input and try again.';
    case 401:
      return 'Authentication required. Please log in again.';
    case 403:
      return 'Access denied. You don\'t have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 409:
      return 'This action conflicts with existing data. Please refresh and try again.';
    case 422:
      return 'Invalid data provided. Please check your input.';
    case 429:
      return 'Too many requests. Please wait a moment and try again.';
    case 500:
      return 'Server error. Please try again later.';
    case 502:
    case 503:
    case 504:
      return 'Service temporarily unavailable. Please try again later.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
};

/**
 * Wraps API calls with comprehensive error handling
 */
export const apiCall = async <T>(
  apiFunction: () => Promise<any>,
  options: {
    retries?: number;
    retryDelay?: number;
    timeoutMs?: number;
    fallbackData?: T;
  } = {}
): Promise<T> => {
  const {
    retries = 0,
    retryDelay = 1000,
    timeoutMs = 30000,
    fallbackData
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Add timeout to the API call
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs);
      });

      const result = await Promise.race([
        apiFunction(),
        timeoutPromise
      ]);

      // Handle standardized API response format
      if (result && typeof result === 'object') {
        if (result.success === false) {
          throw new ApiResponseError(
            result.message || 'API request failed',
            result.code || 500,
            result.error
          );
        }
        
        if (result.success === true) {
          return result.data;
        }
      }

      return result;
    } catch (error) {
      lastError = error;
      
      console.error(`API call attempt ${attempt + 1} failed:`, error);

      // Don't retry on certain error types
      if (
        error.response?.status === 401 || // Unauthorized
        error.response?.status === 403 || // Forbidden
        error.response?.status === 404 || // Not found
        error.response?.status === 422    // Validation error
      ) {
        break;
      }

      // If we have more retries left, wait and try again
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
        continue;
      }
    }
  }

  // If we have fallback data and this isn't a critical error, return it
  if (fallbackData !== undefined && !isAuthError(lastError)) {
    console.warn('Using fallback data due to API error:', lastError);
    return fallbackData;
  }

  // Re-throw the last error
  throw lastError;
};

/**
 * Checks if an error is authentication-related
 */
export const isAuthError = (error: any): boolean => {
  return (
    error.response?.status === 401 ||
    error.response?.status === 403 ||
    error.name === 'AuthenticationError'
  );
};

/**
 * Extracts user-friendly error message from various error types
 */
export const getErrorMessage = (error: any): string => {
  if (error instanceof ValidationError) {
    return error.errors.length > 0 ? error.errors.join(', ') : error.message;
  }

  if (error instanceof ApiResponseError) {
    return error.message;
  }

  if (error instanceof NetworkError) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  if (error?.message) {
    return error.message;
  }

  return handleApiError(error);
};