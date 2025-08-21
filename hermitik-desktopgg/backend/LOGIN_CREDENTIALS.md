# Hermetik Login Credentials

## Backend Server
- **URL**: http://localhost:3001
- **Status**: ✅ Running

## Available Users

### Admin User
- **Email**: admin@example.com
- **Password**: password123
- **Role**: admin

### Regular Users
1. **Brian Robertson ETH**
   - Email: user4@hermetik.com
   - Password: password123
   - Wallets:
     - 0xE71Aa6f45A22Fa1e4C9fB29960248f4A3d4af918
     - 0xbfa2ef4cab56ace20a4e11bb6080a09d126bf5cd

2. **Gary Baron**
   - Email: user5@hermetik.com
   - Password: password123
   - Wallets:
     - 0xb046086f7b6d74a3498d2b994904233ad3246ddc

3. **Lars Kluge**
   - Email: user6@hermetik.com
   - Password: password123
   - Wallets:
     - 0x99b3c496751c5c49a58e99cd0f8bd7242fd6284f

4. **Hermetik**
   - Email: user7@hermetik.com
   - Password: password123
   - Wallets:
     - 0x2F6C914A6DfA61893FF86e05A30Ce0Dc6065fFF1
     - 0x6e1cfdbd65676c9588e4aee278008ff48b986074

5. **Quantizer**
   - Email: user8@hermetik.com
   - Password: password123
   - Wallets:
     - 0x7e73dA415Af2BBCC11f45aeEf7F2cA60222EC736

6. **Brian Robertson - EvoH ACM2**
   - Email: user9@hermetik.com
   - Password: password123
   - Wallets:
     - 0xe71aa6f45a22fa1e4c9fb29960248f4a3d4af918

7. **Brian Robertson - H1 ACM2**
   - Email: user10@hermetik.com
   - Password: password123
   - Wallets:
     - 0xFeC9368cF12dFb61bac48f42E9ccACEDe7CAB659

8. **Gary Baron - BFI EVM ACM2**
   - Email: user11@hermetik.com
   - Password: password123
   - Wallets:
     - 0x14B5AbD73626a0c1182a6E7DEdB54d3dea1D3a14

9. **Quantizer**
   - Email: user12@hermetik.com
   - Password: password123
   - Wallets:
     - 0x7e73dA415Af2BBCC11f45aeEf7F2cA60222EC736

## Frontend Configuration Issue

The frontend is currently configured to use port 5000, but the backend is running on port 3001.

### To Fix Frontend Connection:

1. Create a `.env` file in the frontend directory (`hermitik-desktopgg/frontend1/.env`):
```
VITE_API_BASE_URL=http://localhost:3001/api
VITE_USE_MOCK_API=false
```

2. Restart the frontend development server

## Testing Login

You can test login directly with curl:
```bash
curl -X POST "http://localhost:3001/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "user12@hermetik.com", "password": "password123"}'
```

## Common Issues

1. **Wrong Email**: Make sure to use the exact email addresses listed above
2. **Wrong Port**: Frontend needs to connect to port 3001, not 5000
3. **Wrong Password**: All users use "password123"
