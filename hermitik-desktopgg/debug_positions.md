# Debug: Why Positions Are Not Showing

## Quick Diagnosis Steps:

### 1. Check Real-time API Response
Open browser console and go to Positions page. Look for console logs:
```
=== RAW WALLET DATA ===
=== FLATTENED PROTOCOLS ===
```

### 2. Check if users have DeFi positions
- Most users might only have liquid tokens (no DeFi positions)
- DeFi positions only show if users have:
  - Liquidity pool tokens
  - Lending/borrowing positions  
  - Yield farming positions
  - Staking rewards

### 3. Manual API Test
Test wallet API directly:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3001/api/wallet/wallets
```

### 4. Check Database
Look for positions in DailySnapshot:
```javascript
// In MongoDB
db.dailysnapshots.findOne({}, {positions: 1})
```

## Most Likely Causes:

1. **No DeFi positions**: Users only have liquid tokens, no protocol positions
2. **API timeout**: DeBank API calls might be failing/timing out
3. **Empty protocols array**: Protocols are fetched but empty due to filtering
4. **Frontend filtering**: UI might be filtering out positions

## Quick Fix:
Add some test positions data to verify the UI works correctly.