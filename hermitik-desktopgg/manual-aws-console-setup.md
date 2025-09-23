# Manual AWS Console Setup (Step-by-Step)

## Current Issue
Your EC2 instance `i-0ed3ea6cdcf20f289` is in VPC `vpc-019607e8a825f6114`, but CloudFormation tried to create a new VPC. Let's use the existing VPC instead.

## Step 1: Delete the Failed Stack
1. Go to CloudFormation console
2. Select the failed stack
3. Click "Delete"
4. Wait for deletion to complete

## Step 2: Create Application Load Balancer Manually

### 2.1 Go to EC2 Console → Load Balancers
1. Click "Create Load Balancer"
2. Choose "Application Load Balancer"

### 2.2 Basic Configuration
- **Name:** `hermetik-dashboard-alb`
- **Scheme:** Internet-facing
- **IP address type:** IPv4

### 2.3 Network Mapping
- **VPC:** Select `vpc-019607e8a825f6114` (your existing VPC)
- **Availability Zones:** Select at least 2 AZs with public subnets
- **Subnets:** Choose public subnets in different AZs

### 2.4 Security Groups
1. Click "Create new security group"
2. **Name:** `hermetik-alb-sg`
3. **Description:** Security group for Hermetik ALB
4. **VPC:** `vpc-019607e8a825f6114`
5. **Inbound rules:**
   - HTTP (80) from 0.0.0.0/0
   - HTTPS (443) from 0.0.0.0/0
6. Click "Create security group"
7. Select the newly created security group

### 2.5 Listeners and Routing
1. **Default action:** Create target group
2. **Target group name:** `hermetik-backend-tg`
3. **Target type:** Instances
4. **Protocol:** HTTP
5. **Port:** 3001
6. **VPC:** `vpc-019607e8a825f6114`
7. **Health check path:** `/api/health`
8. Click "Next"

### 2.6 Register Targets
1. Select your EC2 instance `i-0ed3ea6cdcf20f289`
2. **Port:** 3001
3. Click "Include as pending below"
4. Click "Create target group"

### 2.7 Complete ALB Creation
1. Review settings
2. Click "Create load balancer"
3. Wait 2-3 minutes for provisioning

## Step 3: Add HTTPS Listener

### 3.1 Request SSL Certificate
1. Go to Certificate Manager (ACM)
2. Click "Request certificate"
3. Choose "Request a public certificate"
4. **Domain name:** Leave blank (we'll use ALB DNS name)
5. **Validation method:** DNS validation
6. Click "Request"

### 3.2 Add HTTPS Listener to ALB
1. Go back to EC2 → Load Balancers
2. Select your ALB
3. Go to "Listeners" tab
4. Click "Add listener"
5. **Protocol:** HTTPS
6. **Port:** 443
7. **Default action:** Forward to `hermetik-backend-tg`
8. **Security policy:** ELBSecurityPolicy-TLS-1-2-2017-01
9. **Certificate:** Choose "Default SSL certificate"
10. Click "Add"

### 3.3 Update HTTP Listener (Redirect to HTTPS)
1. Select the HTTP:80 listener
2. Click "Edit"
3. **Default action:** Redirect to HTTPS
4. **Port:** 443
5. **Status code:** 301
6. Click "Update"

## Step 4: Create CloudFront Distribution

### 4.1 Go to CloudFront Console
1. Click "Create distribution"

### 4.2 Origin Settings
- **Origin domain:** `hermetik-dashboard-frontend-2025.s3-website-us-east-1.amazonaws.com`
- **Protocol:** HTTP only
- **Origin path:** (leave empty)

### 4.3 Default Cache Behavior
- **Viewer protocol policy:** Redirect HTTP to HTTPS
- **Allowed HTTP methods:** GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
- **Cache policy:** Managed-CachingOptimized

### 4.4 Distribution Settings
- **Price class:** Use all edge locations
- **Default root object:** `index.html`

### 4.5 Custom Error Pages
1. Click "Add custom error response"
2. **HTTP error code:** 404
3. **Response page path:** `/index.html`
4. **HTTP response code:** 200
5. Add another for 403 → 200 → `/index.html`

### 4.6 Create Distribution
1. Click "Create distribution"
2. Wait 10-15 minutes for deployment

## Step 5: Update Security Groups

### 5.1 Update EC2 Security Group
1. Go to EC2 → Security Groups
2. Find your EC2 instance's security group
3. Edit inbound rules:
   - Remove HTTP (80) and HTTPS (443) from 0.0.0.0/0
   - Add HTTP (3001) from ALB security group (`hermetik-alb-sg`)
   - Keep SSH (22) for your IP

## Step 6: Get Your New URLs

After everything is created:
1. **ALB DNS:** Go to Load Balancers → Copy DNS name
2. **CloudFront DNS:** Go to CloudFront → Copy domain name

Your new URLs:
- **Frontend:** `https://d1234567890.cloudfront.net`
- **Backend:** `https://your-alb-dns-name.us-east-1.elb.amazonaws.com/api`

## Step 7: Update Application

### 7.1 Update Frontend Environment
```bash
# In frontend1/.env.production
VITE_API_BASE_URL=https://your-alb-dns-name.us-east-1.elb.amazonaws.com/api
VITE_USE_MOCK_API=false
```

### 7.2 Rebuild and Deploy Frontend
```bash
cd frontend1
npm run build
# Upload dist/ folder to S3 bucket via AWS Console
```

### 7.3 Update Backend Environment
```bash
# In backend/.env.production on EC2
FRONTEND_URL=https://d1234567890.cloudfront.net
```

### 7.4 Restart Backend
```bash
# SSH to EC2 and restart your backend service
sudo systemctl restart your-backend-service
```

## Timeline
- ALB creation: 5 minutes
- CloudFront deployment: 15 minutes
- Total: ~20 minutes

This manual approach avoids VPC conflicts and works with your existing setup!