# Deploying AeroAR with SSL (HTTPS) using nip.io

This guide explains how to deploy the AeroAR application with a valid SSL certificate using `nip.io` and Let's Encrypt. This allows you to have HTTPS without purchasing a domain name.

## Prerequisites

1.  **Ports**: Ensure ports `80` (HTTP) and `443` (HTTPS) are open in your EC2 Security Group. This is **mandatory** for Let's Encrypt validation.

## Configuration

The files have been pre-configured for your IP address: `18.224.184.164`.
Your new domain is: `18.224.184.164.nip.io`

## Step-by-Step Instructions

### 1. Upload Files
Upload your project files to the EC2 instance.

### 2. Initialize Certificates
Run the initialization script on the server. This will get a real, valid certificate for `18.224.184.164.nip.io`.

```bash
sudo ./init-letsencrypt.sh
```

### 3. Run the Application
Start the application in production mode:

```bash
sudo docker compose -f docker-compose.prod.yml up -d
```

### 4. Access the Site
Open your browser and go to:
`https://18.224.184.164.nip.io`

You should see the secure lock icon, and the camera will work without issues.
