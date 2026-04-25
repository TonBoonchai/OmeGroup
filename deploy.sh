#!/usr/bin/env bash
set -e

# ── OmeGroup one-command deploy ────────────────────────────────────────────
# Usage: ./deploy.sh
#
# Before demo day:
#   1. Edit infra/terraform.tfvars — change aws_region and availability zones
#   2. Make sure VERCEL_TOKEN is set (run `vercel login` once, or export the token)
#   3. Run ./deploy.sh
# ───────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INFRA_DIR="$SCRIPT_DIR/infra"
UI_DIR="$SCRIPT_DIR/ui"

# ── 1. Terraform: provision infra + build & upload Lambdas ─────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  Step 1/2 — Terraform apply (infra + Lambda) ║"
echo "╚══════════════════════════════════════════════╝"
cd "$INFRA_DIR"
terraform init -upgrade -reconfigure
terraform apply -auto-approve

# ── 2. Grab the WebSocket URL from Terraform output ────────────────────────
WSS_URL=$(terraform output -raw websocket_connection_url)
echo ""
echo "WebSocket URL: $WSS_URL"

# ── 3. Vercel: inject new WSS URL and redeploy frontend ────────────────────
echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║  Step 2/2 — Vercel frontend deploy           ║"
echo "╚══════════════════════════════════════════════╝"
cd "$UI_DIR"

# Link to Vercel project if not already linked
if [ ! -f ".vercel/project.json" ]; then
  echo "Linking ui/ to Vercel project..."
  vercel link --yes
fi

# Remove old env var (ignore error if it doesn't exist yet)
vercel env rm VITE_WEBSOCKET_URL production --yes 2>/dev/null || true

# Add updated env var
echo "$WSS_URL" | vercel env add VITE_WEBSOCKET_URL production

# Deploy to production
vercel --prod --yes

echo ""
echo "✅  Deploy complete!"
echo "   WebSocket : $WSS_URL"
echo "   Frontend  : check above for your Vercel URL"
