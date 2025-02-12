#!/bin/sh
echo "Updating system packages..."
apt-get update && apt-get install -y wget curl unzip

echo "Installing required libraries for Puppeteer..."
apt-get install -y libnss3 libatk-bridge2.0-0 libxcomposite1 libxrandr2 libgbm1 libasound2 libpangocairo-1.0-0 libcups2

echo "Installing Puppeteer Chrome..."
npx puppeteer install
