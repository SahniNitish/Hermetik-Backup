const axios = require('axios');
require('dotenv').config();

const DEBANK_BASE = 'https://pro-openapi.debank.com/v1';
const CHAINS = ['eth', 'bsc', 'arb', 'matic', 'base', 'op'];

async function debugAPICalls() {
  console.log('🔍 Testing DeBank API calls directly...');
  
  // Test wallet that should have positions
  const testWallet = '0x14B5AbD73626a0c1182a6E7DEdB54d3dea1D3a14';
  
  console.log(`\n📡 Testing API Key...`);
  console.log('API Key exists:', !!process.env.DEBANK_API_KEY);
  console.log('API Key length:', process.env.DEBANK_API_KEY?.length || 0);
  
  // Test tokens first
  console.log(`\n🪙 Testing token fetch for ${testWallet}...`);
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
    
    console.log('✅ Tokens API Success!');
    console.log('Token count:', tokenResponse.data?.length || 0);
    if (tokenResponse.data?.length > 0) {
      console.log('First token sample:', {
        symbol: tokenResponse.data[0].symbol,
        amount: tokenResponse.data[0].amount,
        usd_value: tokenResponse.data[0].usd_value,
        chain: tokenResponse.data[0].chain
      });
    }
  } catch (tokenError) {
    console.error('❌ Tokens API Error:', {
      status: tokenError.response?.status,
      statusText: tokenError.response?.statusText,
      data: tokenError.response?.data,
      message: tokenError.message
    });
  }
  
  // Test protocols  
  console.log(`\n🏦 Testing protocol fetch for ${testWallet}...`);
  try {
    const protocolResponse = await axios.get(
      `${DEBANK_BASE}/user/all_complex_protocol_list`,
      {
        params: { 
          id: testWallet, 
          chain_id: 'eth'
        },
        headers: { 
          AccessKey: process.env.DEBANK_API_KEY, 
          Accept: 'application/json' 
        },
        timeout: 15000
      }
    );
    
    console.log('✅ Protocols API Success!');
    console.log('Protocol count:', protocolResponse.data?.length || 0);
    if (protocolResponse.data?.length > 0) {
      const firstProtocol = protocolResponse.data[0];
      console.log('First protocol sample:', {
        name: firstProtocol.name,
        id: firstProtocol.id,
        chain_id: firstProtocol.chain_id,
        net_usd_value: firstProtocol.net_usd_value,
        portfolio_item_list_count: firstProtocol.portfolio_item_list?.length || 0
      });
      
      if (firstProtocol.portfolio_item_list?.length > 0) {
        const firstItem = firstProtocol.portfolio_item_list[0];
        console.log('First portfolio item:', {
          name: firstItem.name,
          pool_id: firstItem.pool?.id,
          supply_tokens: firstItem.detail?.supply_token_list?.length || 0,
          reward_tokens: firstItem.detail?.reward_token_list?.length || 0
        });
        
        if (firstItem.detail?.supply_token_list?.length > 0) {
          const firstToken = firstItem.detail.supply_token_list[0];
          console.log('First supply token:', {
            symbol: firstToken.symbol,
            amount: firstToken.amount,
            price: firstToken.price,
            usd_value: firstToken.usd_value
          });
        }
      }
    }
  } catch (protocolError) {
    console.error('❌ Protocols API Error:', {
      status: protocolError.response?.status,
      statusText: protocolError.response?.statusText,
      data: protocolError.response?.data,
      message: protocolError.message
    });
  }
  
  console.log('\n🔚 API debugging complete');
}

debugAPICalls().catch(console.error);