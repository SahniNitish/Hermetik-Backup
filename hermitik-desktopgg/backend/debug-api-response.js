const axios = require('axios');
require('dotenv').config();

const DEBANK_BASE = 'https://pro-openapi.debank.com/v1';

async function debugAPIResponse() {
  console.log('🔍 Analyzing complete API response structure...');
  
  const testWallet = '0x14B5AbD73626a0c1182a6E7DEdB54d3dea1D3a14';
  
  // Test full token response structure
  console.log(`\n🪙 Full token response for ETH chain:`);
  try {
    const tokenResponse = await axios.get(
      `${DEBANK_BASE}/user/token_list`,
      {
        params: { 
          id: testWallet, 
          chain_id: 'eth', 
          is_all: false
        },
        headers: { 
          AccessKey: process.env.DEBANK_API_KEY, 
          Accept: 'application/json' 
        },
        timeout: 15000
      }
    );
    
    console.log('Raw token response (first token):');
    console.log(JSON.stringify(tokenResponse.data[0], null, 2));
    
  } catch (error) {
    console.error('Token API Error:', error.message);
  }
  
  // Test full protocol response structure
  console.log(`\n🏦 Full protocol response for ETH chain:`);
  try {
    const protocolResponse = await axios.get(
      `${DEBANK_BASE}/user/all_complex_protocol_list`,
      {
        params: { 
          id: testWallet, 
          chain_id: 'base' // Try base chain since the protocol id was base_uniswap3
        },
        headers: { 
          AccessKey: process.env.DEBANK_API_KEY, 
          Accept: 'application/json' 
        },
        timeout: 15000
      }
    );
    
    console.log('Raw protocol response (first protocol):');
    console.log(JSON.stringify(protocolResponse.data[0], null, 2));
    
  } catch (error) {
    console.error('Protocol API Error:', error.message);
  }
  
  // Try a different wallet that might have more data
  console.log(`\n🔍 Testing with different wallet: 0x99b3c496751c5c49a58e99cd0f8bd7242fd6284f`);
  try {
    const tokenResponse2 = await axios.get(
      `${DEBANK_BASE}/user/token_list`,
      {
        params: { 
          id: '0x99b3c496751c5c49a58e99cd0f8bd7242fd6284f', 
          chain_id: 'eth', 
          is_all: false
        },
        headers: { 
          AccessKey: process.env.DEBANK_API_KEY, 
          Accept: 'application/json' 
        },
        timeout: 15000
      }
    );
    
    if (tokenResponse2.data?.length > 0) {
      console.log('Alternative wallet token:');
      console.log(JSON.stringify(tokenResponse2.data[0], null, 2));
    }
    
  } catch (error) {
    console.error('Alternative wallet Error:', error.message);
  }
}

debugAPIResponse().catch(console.error);