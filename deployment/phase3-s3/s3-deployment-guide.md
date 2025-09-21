# 🌐 Phase 3: S3 + CloudFront Frontend Deployment

## ✅ Current Status
- ✅ **Backend deployed** on EC2: `http://23.20.137.235:3001`
- ✅ **Frontend built** successfully in `dist/` folder
- ✅ **Production environment** configured
- ⏳ **S3 deployment** - Starting now

## Step 1: Create S3 Bucket

### 1.1 Go to AWS S3 Console
1. **AWS Console → S3**
2. **Click "Create bucket"**

### 1.2 Bucket Configuration
- **Bucket name**: `hermetik-dashboard-frontend-2025` (must be globally unique)
- **Region**: `us-east-1` (same as your EC2)
- **Block all public access**: ❌ **UNCHECK** (we need public access)
- **Bucket versioning**: Enable (recommended)
- **Server-side encryption**: Enable (recommended)

### 1.3 Click "Create bucket"

## Step 2: Enable Static Website Hosting

### 2.1 Configure Bucket for Hosting
1. **Click on your new bucket**
2. **Go to "Properties" tab**
3. **Scroll to "Static website hosting"**
4. **Click "Edit"**

### 2.2 Static Website Settings
- **Static website hosting**: ✅ **Enable**
- **Hosting type**: **Host a static website**
- **Index document**: `index.html`
- **Error document**: `index.html` (for React Router)

### 2.3 Click "Save changes"

## Step 3: Configure Bucket Policy

### 3.1 Set Public Read Policy
1. **Go to "Permissions" tab**
2. **Click "Bucket policy" → "Edit"**
3. **Add this policy** (replace `hermetik-dashboard-frontend-2025` with your actual bucket name):

```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "PublicReadGetObject",
            "Effect": "Allow",
            "Principal": "*",
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::hermetik-dashboard-frontend-2025/*"
        }
    ]
}
```

### 3.2 Click "Save changes"

## Step 4: Upload Frontend Files

### 4.1 Upload via AWS Console
1. **Go to "Objects" tab**
2. **Click "Upload"**
3. **Click "Add folder"**
4. **Select your `dist` folder** from: `/Users/NitishSahni/Desktop/Hermetik-Backup/hermitik-desktopgg/frontend1/dist`
5. **Click "Upload"**

### 4.2 Alternative - Upload via AWS CLI
```bash
# If you prefer command line (from your local machine)
aws s3 sync ./dist/ s3://hermetik-dashboard-frontend-2025/ --delete
```

## Step 5: Get Website URL

### 5.1 Get S3 Website Endpoint
1. **Go to "Properties" tab**
2. **Scroll to "Static website hosting"**
3. **Copy the "Bucket website endpoint"**
4. **URL format**: `http://hermetik-dashboard-frontend-2025.s3-website-us-east-1.amazonaws.com`

## Step 6: Test Your Deployment

### 6.1 Test Frontend Access
1. **Open the S3 website URL** in your browser
2. **You should see** the Hermetik login page

### 6.2 Test Backend Connection
1. **Try logging in** with: `admin@example.com` / `password123`
2. **Check if** portfolio data loads
3. **Test NAV export** functionality

## Step 7: Optional - Add CloudFront CDN

### 7.1 Create CloudFront Distribution
1. **AWS Console → CloudFront**
2. **Click "Create distribution"**
3. **Origin domain**: Select your S3 bucket
4. **Default root object**: `index.html`

### 7.2 Configure for React Router
- **Error pages**: Add custom error response
  - **HTTP error code**: `404`
  - **Response page path**: `/index.html`
  - **HTTP response code**: `200`

## Expected Results

After deployment:
- ✅ **Frontend URL**: `http://your-bucket.s3-website-us-east-1.amazonaws.com`
- ✅ **Login working**: Connects to EC2 backend
- ✅ **Portfolio data**: Loading from EC2
- ✅ **NAV exports**: Working with real data
- ✅ **All features**: Fully functional

## Troubleshooting

### Common Issues

1. **403 Forbidden**: Check bucket policy allows public read
2. **404 Not Found**: Verify index.html exists and static hosting enabled
3. **CORS errors**: Update backend CORS to include S3 URL
4. **Login fails**: Check API URL in environment variables

### Backend CORS Update

If you get CORS errors, update your backend (on EC2):

```javascript
// In backend/index.js, update CORS to include your S3 URL
app.use(cors({
  origin: [
    'http://hermetik-dashboard-frontend-2025.s3-website-us-east-1.amazonaws.com',
    'http://localhost:5173'
  ],
  credentials: true
}));
```

## Cost Estimate

- **S3 hosting**: ~$1-5/month
- **CloudFront (optional)**: ~$1-10/month
- **Data transfer**: ~$1-5/month
- **Total**: ~$3-20/month (much cheaper than Amplify!)

## Next Steps

1. **Create S3 bucket** with static hosting
2. **Upload your built files**
3. **Test the deployment**
4. **Optional**: Add CloudFront for better performance
