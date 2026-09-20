#!/bin/bash
echo "========================================"
echo " Aether VPN MacOS App - Upload to GitHub"
echo "========================================"
echo ""
echo "This script will push the project to GitHub."
echo ""
read -p "Enter your GitHub username: " USERNAME
read -sp "Enter your GitHub Personal Access Token: " TOKEN
echo ""
echo ""

# Set the remote URL with token
cd "$(dirname "$0")"
git remote set-url origin "https://${USERNAME}:${TOKEN}@github.com/javadhamed/Aether-VPN-MacOS-App.git"

# Push
git push -u origin main 2>&1

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Successfully uploaded to GitHub!"
  echo "View at: https://github.com/javadhamed/Aether-VPN-MacOS-App"
else
  echo ""
  echo "❌ Upload failed. Check your credentials."
fi
