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

2. **Gary Baron**
   - Email: user5@hermetik.com
   - Password: password123

3. **Lars Kluge**
   - Email: user6@hermetik.com
   - Password: password123

4. **Hermetik**
   - Email: user7@hermetik.com
   - Password: password123

5. **Quantizer**
   - Email: user8@hermetik.com
   - Password: password123

6. **Brian Robertson - EvoH ACM2**
   - Email: user9@hermetik.com
   - Password: password123

7. **Brian Robertson - H1 ACM2**
   - Email: user10@hermetik.com
   - Password: password123

8. **Gary Baron - BFI EVM ACM2**
   - Email: user11@hermetik.com
   - Password: password123

9. **Quantizer**
   - Email: user12@hermetik.com
   - Password: password123

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
