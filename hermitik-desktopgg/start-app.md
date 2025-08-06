# 🚀 Start Hermetik App - Complete Guide

## ✅ **Fixed Issues:**
1. **Port Configuration** - Backend: 3001, Frontend: 5174
2. **CORS Configuration** - Updated to allow frontend ports
3. **API Endpoints** - Fixed field name mismatches
4. **Authentication Flow** - Updated to use email instead of username
5. **Data Transformation** - Backend responses now match frontend types
6. **Environment Variables** - Configured for development

## 🔧 **Start the Application:**

### **1. Start Backend Server**
```bash
cd backend
npm run dev
```
**Backend runs on:** http://localhost:3001

### **2. Start Frontend Server**
```bash
cd frontend1
npm run dev
```
**Frontend runs on:** http://localhost:5174

## 🎯 **Test the Connection:**

### **Available Test Accounts:**
- **Admin**: admin@example.com / admin123
- **Gary Baron**: gary@example.com / gary123  
- **Lars Kluge**: lars@example.com / lars123
- **Brian Robertson**: brian@example.com / brian123

### **Test Steps:**
1. **Visit:** http://localhost:5174
2. **Login** with any test account
3. **Dashboard** should show wallet data
4. **Navigation** should work between pages

## 🔍 **API Endpoints Working:**
- ✅ `POST /api/auth/login` - User authentication
- ✅ `GET /api/auth/profile` - User profile
- ✅ `POST /api/auth/add-wallet` - Add wallet address
- ✅ `GET /api/wallet/wallets` - Fetch wallet data
- ✅ `GET /api/health` - Backend health check

## 📊 **Expected Data Flow:**
1. **Login** → JWT token stored in localStorage
2. **Dashboard** → Fetches wallet portfolio data
3. **Tokens Page** → Shows individual token balances  
4. **Positions Page** → Shows DeFi protocol positions
5. **Analytics** → Portfolio performance metrics

## 🛠 **Troubleshooting:**
- **CORS Error**: Backend automatically allows frontend ports
- **Login Issues**: Use email (not username) for login
- **No Data**: Make sure wallets are added to user accounts
- **Port Conflicts**: Backend uses 3001, Frontend uses 5174

**Everything is now configured and ready to work end-to-end!** 🎉