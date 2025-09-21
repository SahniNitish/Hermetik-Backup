# AWS Security Setup Guide

## Current Status
- Backend: EC2 at `23.20.137.235:3001` (HTTP)
- Frontend: S3 static hosting (HTTP)
- URL: `http://hermetik-dashboard-frontend-2025.s3-website-us-east-1.amazonaws.com/users`

## Security Implementation Steps

### Step 1: Domain & SSL Certificate
1. **Purchase/Configure Domain** (if you don't have one)
   - Register a domain (e.g., `hermetik-dashboard.com`)
   - Or use a subdomain from existing domain

2. **Request SSL Certificate in AWS Certificate Manager (ACM)**
   ```bash
   # Via AWS CLI (if you have it configured)
   aws acm request-certificate \
     --domain-name hermetik-dashboard.com \
     --domain-name *.hermetik-dashboard.com \
     --validation-method DNS \
     --region us-east-1
   ```

### Step 2: CloudFront Distribution for Frontend
1. **Create CloudFront Distribution**
   - Origin: Your S3 bucket
   - SSL Certificate: Use the ACM certificate
   - Redirect HTTP to HTTPS
   - Custom domain name

### Step 3: Application Load Balancer for Backend
1. **Create Application Load Balancer (ALB)**
   - Target: Your EC2 instance
   - SSL Certificate: Use the ACM certificate
   - Health checks on `/api/health`

### Step 4: Update Security Groups
1. **EC2 Security Group**
   - Allow HTTPS (443) from ALB only
   - Allow HTTP (3001) from ALB only
   - Remove direct public access

2. **ALB Security Group**
   - Allow HTTPS (443) from anywhere
   - Allow HTTP (80) from anywhere (for redirect)

### Step 5: Update Application Configuration
1. **Backend Environment Variables**
2. **Frontend API URLs**
3. **CORS Configuration**

## Quick Setup Option (Without Custom Domain)
If you want to secure quickly without a custom domain:
1. Use CloudFront with default SSL certificate
2. Use ALB with AWS-provided certificate
3. Update frontend to use HTTPS URLs