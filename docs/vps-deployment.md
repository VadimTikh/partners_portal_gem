# VPS Deployment Guide

This guide explains how to deploy the Miomente Partners Portal as a Docker container on an Ubuntu VPS with a custom domain and SSL.

## Prerequisites

- Ubuntu VPS (20.04 or later)
- Domain name pointing to your VPS
- SSH access to the VPS
- Docker installed locally

## 1. Build the Docker Image (Local Machine)

```bash
# Navigate to project directory
cd /path/to/miomente_partners_portal_gem

# Build the image with your n8n API URL
docker build \
  --build-arg NEXT_PUBLIC_N8N_API_URL="https://your-n8n-url.com/webhook" \
  -t miomente-portal .
```

## 2. Transfer Image to VPS

```bash
# Save and compress the image
docker save miomente-portal | gzip > miomente-portal.tar.gz

# Transfer to VPS
scp miomente-portal.tar.gz user@your-vps-ip:~
```

## 3. VPS Initial Setup

SSH into your VPS:

```bash
ssh user@your-vps-ip
```

Install required packages:

```bash
sudo apt update
sudo apt install -y docker.io nginx certbot python3-certbot-nginx
```

Enable and start Docker:

```bash
sudo systemctl enable docker
sudo systemctl start docker
```

## 4. Load and Run the Container

```bash
# Load the Docker image
gunzip -c ~/miomente-portal.tar.gz | sudo docker load

# Run the container
sudo docker run -d \
  --name miomente-portal \
  -p 127.0.0.1:8080:8080 \
  --restart unless-stopped \
  miomente-portal
```

Verify it's running:

```bash
sudo docker ps
curl http://localhost:8080
```

## 5. Configure DNS

In your domain registrar's DNS settings, add these records:

| Type | Name | Value           |
|------|------|-----------------|
| A    | @    | your-vps-ip     |
| A    | www  | your-vps-ip     |

DNS propagation can take up to 24 hours, but usually completes within minutes.

## 6. Configure Nginx Reverse Proxy

Create the Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/miomente-portal
```

Add this configuration (replace `yourdomain.com` with your actual domain):

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and restart Nginx:

```bash
sudo ln -s /etc/nginx/sites-available/miomente-portal /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## 7. Install SSL Certificate

Use Let's Encrypt for a free SSL certificate:

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts:
1. Enter your email address
2. Agree to terms of service
3. Choose whether to redirect HTTP to HTTPS (recommended: yes)

Certbot automatically configures SSL and sets up auto-renewal.

Verify auto-renewal is configured:

```bash
sudo certbot renew --dry-run
```

## Maintenance Commands

### View Logs

```bash
# Follow logs in real-time
sudo docker logs -f miomente-portal

# View last 100 lines
sudo docker logs --tail 100 miomente-portal
```

### Restart Container

```bash
sudo docker restart miomente-portal
```

### Update Deployment

When you have a new version:

```bash
# On local machine: build and transfer new image
docker build --build-arg NEXT_PUBLIC_N8N_API_URL="https://your-n8n-url.com/webhook" -t miomente-portal .
docker save miomente-portal | gzip > miomente-portal.tar.gz
scp miomente-portal.tar.gz user@your-vps-ip:~

# On VPS: stop, remove, load new image, and run
sudo docker stop miomente-portal
sudo docker rm miomente-portal
gunzip -c ~/miomente-portal.tar.gz | sudo docker load
sudo docker run -d \
  --name miomente-portal \
  -p 127.0.0.1:8080:8080 \
  --restart unless-stopped \
  miomente-portal
```

### Check Container Status

```bash
# List running containers
sudo docker ps

# Check container resource usage
sudo docker stats miomente-portal
```

### Clean Up Old Images

```bash
# Remove unused images
sudo docker image prune -a
```

## Troubleshooting

### Container won't start

```bash
# Check logs for errors
sudo docker logs miomente-portal

# Check if port is already in use
sudo lsof -i :8080
```

### Nginx errors

```bash
# Test configuration
sudo nginx -t

# Check Nginx logs
sudo tail -f /var/log/nginx/error.log
```

### SSL certificate issues

```bash
# Renew certificate manually
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

### Container keeps restarting

```bash
# Check restart count
sudo docker inspect miomente-portal | grep RestartCount

# View recent logs
sudo docker logs --tail 50 miomente-portal
```

## Security Recommendations

1. **Firewall**: Configure UFW to allow only necessary ports

   ```bash
   sudo ufw allow ssh
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

2. **Fail2ban**: Install to prevent brute force attacks

   ```bash
   sudo apt install fail2ban
   sudo systemctl enable fail2ban
   ```

3. **Updates**: Keep system updated

   ```bash
   sudo apt update && sudo apt upgrade -y
   ```
