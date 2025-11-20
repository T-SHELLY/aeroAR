#!/bin/bash

# Create directory for certificates
mkdir -p ./nginx/certs

# Generate self-signed certificate
# This allows HTTPS, but browsers will show a warning because it's not from a trusted authority.
# This is the ONLY way to get HTTPS on an AWS default domain (ec2-xx-xx.compute.amazonaws.com).

echo "Generating self-signed certificate..."
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ./nginx/certs/selfsigned.key \
    -out ./nginx/certs/selfsigned.crt \
    -subj "/C=US/ST=Dev/L=Dev/O=Dev/CN=localhost"

echo "Certificate generated in ./nginx/certs/"
