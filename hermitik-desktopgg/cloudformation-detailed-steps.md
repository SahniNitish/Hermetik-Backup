# CloudFormation Detailed Step-by-Step Guide

## Prerequisites
1. **Get your EC2 Instance ID first:**
   - Go to AWS Console → EC2 → Instances
   - Find your running instance
   - Copy the Instance ID (looks like `i-1234567890abcdef0`)

## Step-by-Step CloudFormation Process

### Step 1: Access CloudFormation
1. Log into AWS Console
2. Search for "CloudFormation" in the search bar
3. Click on "CloudFormation" service

### Step 2: Create Stack - Initial Screen
1. Click **"Create stack"** button
2. You'll see options:
   - ✅ **Choose "With new resources (standard)"** ← SELECT THIS
   - ❌ Don't choose "With existing resources"

### Step 3: Specify Template
1. **Template source:** Choose **"Upload a template file"**
2. Click **"Choose file"** button
3. Select the `simple-cloudformation-template.yaml` file from your computer
4. Click **"Next"**

### Step 4: Stack Details
1. **Stack name:** Enter `hermetik-dashboard-secure`
2. **Parameters section:**
   - **EC2InstanceId:** Enter your EC2 instance ID (e.g., `i-1234567890abcdef0`)
   - **S3BucketName:** Keep default `hermetik-dashboard-frontend-2025`
3. Click **"Next"**

### Step 5: Configure Stack Options
1. **Tags (optional):** You can add tags like:
   - Key: `Project`, Value: `Hermetik Dashboard`
   - Key: `Environment`, Value: `Production`
2. **Permissions:** Leave as default (use current role)
3. **Stack failure options:** Leave as default
4. **Advanced options:** Leave as default
5. Click **"Next"**

### Step 6: Review and Create
1. **Review all settings:**
   - Stack name: `hermetik-dashboard-secure`
   - Template: Your uploaded file
   - Parameters: Your EC2 instance ID and S3 bucket
2. **Capabilities section:** 
   - ✅ Check **"I acknowledge that AWS CloudFormation might create IAM resources"**
3. Click **"Submit"** (or "Create stack")

### Step 7: Monitor Progress
1. You'll see the stack status as **"CREATE_IN_PROGRESS"**
2. Click on **"Events"** tab to see real-time progress
3. Wait 10-15 minutes for completion
4. Status will change to **"CREATE_COMPLETE"**

### Step 8: Get Your New URLs
1. Click on **"Outputs"** tab
2. You'll see:
   - **ALBDNSName:** Your backend HTTPS URL
   - **CloudFrontDNSName:** Your frontend HTTPS URL
   - **BackendURL:** Complete API URL
   - **FrontendURL:** Complete frontend URL

## What You'll See During Creation

### Resources Being Created:
- ✅ VPC and networking components
- ✅ Application Load Balancer
- ✅ Target Group (pointing to your EC2)
- ✅ Security Groups
- ✅ CloudFront Distribution
- ✅ SSL Certificate

### Timeline:
- **0-2 minutes:** VPC and networking
- **2-5 minutes:** Load Balancer and Target Group
- **5-15 minutes:** CloudFront Distribution (takes longest)
- **Total:** ~15 minutes

## After Completion

### Your New Secure URLs:
- **Frontend:** `https://d1234567890.cloudfront.net`
- **Backend:** `https://your-alb-name.us-east-1.elb.amazonaws.com/api`

### Next Steps:
1. Update frontend environment variables
2. Rebuild and redeploy frontend to S3
3. Test the new HTTPS endpoints

## Troubleshooting

### If Stack Creation Fails:
1. Check **"Events"** tab for error details
2. Common issues:
   - Wrong EC2 Instance ID format
   - EC2 instance not in default VPC
   - Insufficient permissions

### If You Need to Delete and Retry:
1. Select the failed stack
2. Click **"Delete"**
3. Wait for deletion to complete
4. Start over with corrected parameters

## Important Notes:
- ✅ Choose "With new resources (standard)" when creating stack
- ✅ The template creates NEW networking resources (VPC, subnets)
- ✅ Your existing EC2 and S3 remain unchanged
- ✅ No downtime during setup
- ✅ You can delete the stack later if needed