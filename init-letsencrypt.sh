#!/bin/bash

if ! docker compose version > /dev/null 2>&1; then
  echo 'Error: docker compose is not installed or available.' >&2
  exit 1
fi

domains=(18.224.184.164.nip.io)
rsa_key_size=4096
data_path="./data/certbot"
email="" # Add your email here for renewal notifications
staging=0 # Set to 1 if you're testing your setup to avoid hitting request limits

# 1. Prepare the environment
echo "### Preparing Nginx configuration for validation..."
# We temporarily use a simple HTTP-only config to allow Nginx to start without certs
cp ./nginx/conf.d/init.conf ./nginx/conf.d/app.conf

# 2. Start Nginx
echo "### Starting nginx ..."
docker compose -f docker-compose.prod.yml up --force-recreate -d nginx
echo

# 3. Request the certificate
echo "### Requesting Let's Encrypt certificate for $domains ..."
#Join $domains to -d args
domain_args=""
for domain in "${domains[@]}"; do
  domain_args="$domain_args -d $domain"
done

# Select appropriate email arg
case "$email" in
  "") email_arg="--register-unsafely-without-email" ;;
  *) email_arg="-m $email" ;;
esac

# Enable staging mode if needed
if [ $staging != "0" ]; then staging_arg="--staging"; fi

docker compose -f docker-compose.prod.yml run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    $domain_args \
    --rsa-key-size $rsa_key_size \
    --agree-tos \
    --force-renewal" certbot
echo

# 4. Restore the full configuration
echo "### Restoring full Nginx configuration..."
# We write the full config back (using the content we know we want)
# Note: We are re-writing the file here to ensure it's correct. 
# If you customized app.conf manually, this script would overwrite it.
cat > ./nginx/conf.d/app.conf <<EOF
server {
    listen 80;
    server_name 18.224.184.164.nip.io;
    server_tokens off;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name 18.224.184.164.nip.io;
    server_tokens off;

    ssl_certificate /etc/letsencrypt/live/18.224.184.164.nip.io/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/18.224.184.164.nip.io/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass  http://aeroar:80;
        proxy_set_header    Host                \$http_host;
        proxy_set_header    X-Real-IP           \$remote_addr;
        proxy_set_header    X-Forwarded-For     \$proxy_add_x_forwarded_for;
    }
}
EOF

# 5. Reload Nginx to pick up the new certs and config
echo "### Reloading nginx ..."
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
