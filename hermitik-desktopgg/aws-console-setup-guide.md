# AWS Console Setup Guide (No CLI Required)

## Current Status
- Backend: EC2 at `23.20.137.235:3001` (HTTP)
- Frontend: S3 bucket `hermetik-dashboard-frontend-2025` (HTTP)

## Step-by-Step AWS Console Setup

### Step 1: Create Application Load Balancer (ALB)

1. **Go to EC2 Console** → Load Balancers → Create Load Balancer
2. **Choose Application Load Balancer**
3. **Basic Configuration:**
   - Name: `hermetik-dashboard-alb`
   - Scheme: Internet-facing
   - IP address type: IPv4

4. **Network mapping:**
   - VPC: Select your default VPC
   - Availability Zones: Select at least 2 AZs
   - Subnets: Select public subnets

5. **Security groups:**
   - Create new security group: `hermetik-alb-sg`
   - Allow HTTP (80) from 0.0.0.0/0
   - Allow HTTPS (443) from 0.0.0.0/0

6. **Listeners and routing:**
   - Create target group: `hermetik-backend-tg`
   - Target type: Instances
   - Protocol: HTTP, Port: 3001
   - Health check path: `/api/health`
   - Register your EC2 instance as target

7. **Create Load Balancer**

### Step 2: Create CloudFront Distribution

1. **Go to CloudFront Console** → Create Distribution
2. **Origin Settings:**
   - Origin domain: `hermetik-dashboard-frontend-2025.s3-website-us-east-1.amazonaws.com`
   - Protocol: HTTP only
   - Origin path: (leave empty)

3. **Default Cache Behavior:**
   - Viewer protocol policy: Redirect HTTP to HTTPS
   - Allowed HTTP methods: GET, HEAD, OPTIONS
   - Cache policy: Managed-CachingOptimized

4. **Distribution Settings:**
   - Price class: Use all edge locations
   - Default root object: `index.html`

5. **Create Distribution** (takes 10-15 minutes to deploy)

### Step 3: Update Security Groups

1. **EC2 Security Group** (your existing one):
   - Edit inbound rules
   - Remove HTTP (80) and HTTPS (443) from 0.0.0.0/0
   - Add HTTP (3001) from ALB security group only
   - Keep SSH (22) for your IP

### Step 4: Get Your New URLs

After setup completes:
- **Frontend HTTPS URL**: `https://d1234567890.cloudfront.net` (from CloudFront)
- **Backend HTTPS URL**: `https://your-alb-name.us-east-1.elb.amazonaws.com/api` (from ALB)

### Step 5: Update Your Application

1. **Update Frontend Environment:**
   ```bash
   # In frontend1/.env.production
   VITE_API_BASE_URL=https://your-alb-name.us-east-1.elb.amazonaws.com/api
   VITE_USE_MOCK_API=false
   ```

2. **Update Backend Environment:**
   ```bash
   # In backend/.env.production
   FRONTEND_URL=https://d1234567890.cloudfront.net
   ```

3. **Rebuild and Deploy:**
   ```bash
   # Build frontend
   cd frontend1
   npm run build
   
   # Upload to S3 (via AWS Console or drag-drop)
   # Restart backend on EC2
   ```

## Alternative: Quick Manual Setup

### Option A: Use Elastic Beanstalk
1. Go to Elastic Beanstalk Console
2. Create new application
3. Upload your backend code
4. EB automatically creates ALB with HTTPS

### Option B: Use AWS Amplify (Frontend only)
1. Go to AWS Amplify Console
2. Connect your GitHub repo
3. Amplify automatically provides HTTPS
4. Still need ALB for backend

### Option C: Use CloudFormation Template
1. Go to CloudFormation Console
2. Create Stack → Upload template
3. Use the `aws-infrastructure.yaml` file I created
4. Fill in parameters via web form

## Recommended Approach
**CloudFormation via Console** is easiest:
1. Download the `aws-infrastructure.yaml` file
2. Go to CloudFormation Console
3. Create stack with the template
4. Fill parameters in web form
5. Wait for completion (~10 minutes)