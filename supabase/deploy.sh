#!/usr/bin/env bash
# ════════════════════════════════════════════════════════════════
# Deploy EVNHANOI Edge Functions lên Supabase
# Yêu cầu: đã cài Supabase CLI (https://supabase.com/docs/guides/cli)
#
# Sử dụng:
#   1. cd vào thư mục project (cùng cấp /supabase)
#   2. ./deploy.sh
# ════════════════════════════════════════════════════════════════
set -euo pipefail

PROJECT_REF="${PROJECT_REF:-xqqmfmljwycpehfyknoy}"  # ← project ref của bạn

echo "═══════════════════════════════════════════════════════"
echo "  Deploy Edge Functions cho project: $PROJECT_REF"
echo "═══════════════════════════════════════════════════════"

# Đảm bảo CLI đã link với project
if ! supabase status >/dev/null 2>&1; then
  echo "→ Đang link với project Supabase..."
  supabase link --project-ref "$PROJECT_REF"
fi

# Deploy từng function (theo flag --no-verify-jwt vì ta tự verify trong function)
for fn in bbtn-list bbtn-download asset-upload asset-download nas-health-check; do
  echo ""
  echo "→ Deploying: $fn"
  supabase functions deploy "$fn" --project-ref "$PROJECT_REF" --no-verify-jwt
done

echo ""
echo "✅ Hoàn tất. Endpoints:"
echo "   https://${PROJECT_REF}.supabase.co/functions/v1/bbtn-list"
echo "   https://${PROJECT_REF}.supabase.co/functions/v1/bbtn-download"
echo "   https://${PROJECT_REF}.supabase.co/functions/v1/asset-upload"
echo "   https://${PROJECT_REF}.supabase.co/functions/v1/asset-download"
echo "   https://${PROJECT_REF}.supabase.co/functions/v1/nas-health-check"
echo ""
echo "⚠️  Đừng quên set secrets (tên đã chuẩn theo UI Supabase):"
echo "   supabase secrets set NAS_BASE_URL=https://your-ngrok-url.ngrok-free.dev"
echo "   supabase secrets set NAS_USERNAME=evnservice"
echo "   supabase secrets set NAS_PASSWORD=yourpassword"
echo "   supabase secrets set NAS_BBTN_PATH=/BBTN"
echo "   supabase secrets set NAS_ASSET_PATH=/TNDK"
