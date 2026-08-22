#!/bin/bash

# FXC Admin Key Setup Script
# Run this after starting the backend server

SECRET_KEY="fsdkfjsaldfjljj@(@&$!(48420ufasnda,ancsdlfj**2918300pubgetdfxckhdksij13lfkhushadixyzdeepchartchutiyabhaangbhoasxyz23091kjlad"
BACKEND_URL="http://localhost:5000"

echo "🔐 Setting up FXC Admin Key..."
echo ""

curl -X POST "$BACKEND_URL/api/init/setup" \
  -H "Content-Type: application/json" \
  -d "{\"secretKey\":\"$SECRET_KEY\"}"

echo ""
echo ""
echo "✅ Setup complete!"
echo "Your secret key has been stored in MongoDB with bcrypt encryption."
echo ""
echo "Next steps:"
echo "1. Start the frontend: cd fxc && npm run dev"
echo "2. Click 'Admin' button on website"
echo "3. Paste your secret key to login"
