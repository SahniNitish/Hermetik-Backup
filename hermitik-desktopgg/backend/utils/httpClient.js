/**
 * Shared HTTP Client Utility
 * Eliminates duplicate axios patterns and provides consistent error handling
 */

const axios = require('axios');

class HttpClient {
  constructor() {
    this.defaultTimeout = 10000;
    this.maxRetries = 3;
    this.retryDelay = 1000;
  }

  /**
   * Creates a standardized axios instance with common configurations
   * @param {string} baseURL - Base URL for the API
   * @param {Object} defaultHeaders - Default headers to include
   * @returns {Object} Configured axios instance
   */
  createInstance(baseURL, defaultHeaders = {}) {
    return axios.create({
      baseURL,
      timeout: this.defaultTimeout,
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Hermetik-Backend/1.0',
        ...defaultHeaders
      }
    });
  }

  /**
   * Makes an HTTP GET request with standardized error handling and retry logic
   * @param {string} url - The URL to request
   * @param {Object} options - Request options
   * @param {Object} options.params - Query parameters
   * @param {Object} options.headers - Additional headers
   * @param {number} options.timeout - Request timeout
   * @param {number} options.retries - Number of retries
   * @returns {Promise<any>} Response data
   */
  async get(url, options = {}) {
    const {
      params = {},
      headers = {},
      timeout = this.defaultTimeout,
      retries = this.maxRetries,
      baseURL = ''
    } = options;

    const config = {
      method: 'GET',
      url: baseURL ? `${baseURL}${url}` : url,
      params,
      headers,
      timeout
    };

    return this.executeWithRetry(config, retries);
  }

  /**
   * Makes an HTTP POST request with standardized error handling
   * @param {string} url - The URL to request
   * @param {any} data - Request body data
   * @param {Object} options - Request options
   * @returns {Promise<any>} Response data
   */
  async post(url, data, options = {}) {
    const {
      headers = {},
      timeout = this.defaultTimeout,
      retries = this.maxRetries,
      baseURL = ''
    } = options;

    const config = {
      method: 'POST',
      url: baseURL ? `${baseURL}${url}` : url,
      data,
      headers,
      timeout
    };

    return this.executeWithRetry(config, retries);
  }

  /**
   * Executes a request with retry logic and standardized error handling
   * @param {Object} config - Axios request configuration
   * @param {number} retries - Number of retries remaining
   * @returns {Promise<any>} Response data
   */
  async executeWithRetry(config, retries) {
    const operationId = `http-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      console.log(`🌐 [${operationId}] Making ${config.method} request to ${config.url}`);
      
      const response = await axios(config);
      
      console.log(`✅ [${operationId}] Request successful (${response.status})`);
      return response.data;
      
    } catch (error) {
      const errorInfo = {
        operationId,
        url: config.url,
        method: config.method,
        status: error.response?.status,
        message: error.message,
        retries
      };

      console.error(`❌ [${operationId}] Request failed:`, errorInfo);

      // Don't retry on client errors (4xx) except 429 (rate limit)
      const shouldNotRetry = error.response?.status >= 400 && 
                            error.response?.status < 500 && 
                            error.response?.status !== 429;

      if (retries > 0 && !shouldNotRetry) {
        console.log(`🔄 [${operationId}] Retrying in ${this.retryDelay}ms... (${retries} retries left)`);
        await this.sleep(this.retryDelay);
        return this.executeWithRetry(config, retries - 1);
      }

      // Enhance error with context
      const enhancedError = new Error(
        `HTTP ${config.method} request to ${config.url} failed: ${error.message}`
      );
      enhancedError.originalError = error;
      enhancedError.operationId = operationId;
      enhancedError.statusCode = error.response?.status;
      enhancedError.responseData = error.response?.data;

      throw enhancedError;
    }
  }

  /**
   * Creates a specialized DeBank API client
   * @returns {Object} DeBank API client
   */
  createDebankClient() {
    const debankBase = 'https://pro-openapi.debank.com/v1';
    const apiKey = process.env.DEBANK_API_KEY;

    if (!apiKey) {
      throw new Error('DEBANK_API_KEY environment variable is required');
    }

    return {
      get: (endpoint, params = {}) => this.get(endpoint, {
        baseURL: debankBase,
        params,
        headers: {
          'AccessKey': apiKey
        }
      }),
      
      post: (endpoint, data, params = {}) => this.post(endpoint, data, {
        baseURL: debankBase,
        params,
        headers: {
          'AccessKey': apiKey
        }
      })
    };
  }

  /**
   * Creates a specialized CoinGecko API client
   * @returns {Object} CoinGecko API client
   */
  createCoinGeckoClient() {
    const coinGeckoBase = 'https://api.coingecko.com/api/v3';

    return {
      get: (endpoint, params = {}) => this.get(endpoint, {
        baseURL: coinGeckoBase,
        params
      })
    };
  }

  /**
   * Utility method to sleep for a specified duration
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Validates and formats wallet address
   * @param {string} address - Wallet address to validate
   * @returns {string} Formatted address
   * @throws {Error} If address is invalid
   */
  validateWalletAddress(address) {
    if (!address || typeof address !== 'string') {
      throw new Error('Wallet address is required and must be a string');
    }

    const formattedAddress = address.toLowerCase().trim();
    
    if (!/^0x[a-f0-9]{40}$/.test(formattedAddress)) {
      throw new Error(`Invalid Ethereum wallet address format: ${address}`);
    }

    return formattedAddress;
  }

  /**
   * Validates chain ID
   * @param {string} chainId - Chain ID to validate
   * @returns {string} Validated chain ID
   */
  validateChainId(chainId) {
    const validChains = ['eth', 'bsc', 'arb', 'matic', 'base', 'op'];
    
    if (!validChains.includes(chainId)) {
      throw new Error(`Invalid chain ID: ${chainId}. Valid chains: ${validChains.join(', ')}`);
    }

    return chainId;
  }
}

// Export singleton instance
module.exports = new HttpClient();