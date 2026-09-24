#!/usr/bin/env bash
# Script: Make Admin (TEMPORARY)
# Purpose: Promote an existing account to administrator on the deployed app
# Usage: ./make-admin.sh name@acme.inc

set -e

# Usage helper
if [ -z "$1" ] || [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    echo "Usage: $0 name@acme.inc"
    echo "Promote an existing account to administrator (TEMPORARY)"
    echo ""
    echo "Description:"
    echo "  Invokes the deployed API Lambda directly, which needs your AWS"
    echo "  credentials; the public website cannot do this. The person signs"
    echo "  out and back in to see the admin console."
    echo ""
    echo "Options:"
    echo "  -h, --help      Show this help message"
    echo ""
    echo "Requirements:"
    echo "  - aws cli, jq and terraform installed"
    echo "  - Backend deployed (./bin/deploy-backend.sh)"
    exit 0
fi

# Verify required dependencies
aws --version > /dev/null 2>&1 || { echo "ERROR: 'aws' is missing. Aborting..."; exit 1; }
jq --version > /dev/null 2>&1 || { echo "ERROR: 'jq' is missing. Aborting..."; exit 1; }
terraform --version > /dev/null 2>&1 || { echo "ERROR: 'terraform' is missing. Aborting..."; exit 1; }

# Resolve script directory and project root paths
SCRIPT_DIR="$(cd "$(dirname "$0")" > /dev/null 2>&1 || exit 1; pwd -P)"
PROJECT_ROOT="$(cd $SCRIPT_DIR/.. > /dev/null 2>&1 || exit 1; pwd -P)"
ENVIRONMENT_CONFIG="$PROJECT_ROOT/ENVIRONMENT.config"
INFRA_DIR="$PROJECT_ROOT/infra"

# Load participant credentials; refresh them if they have expired
if [ -f "$ENVIRONMENT_CONFIG" ]; then
    source "$ENVIRONMENT_CONFIG"
fi
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    $SCRIPT_DIR/setup-participant.sh > /dev/null
    source "$ENVIRONMENT_CONFIG"
fi

# Find the api Lambda and its region from Terraform outputs
cd "$INFRA_DIR"
LAMBDA_URLS=$(terraform output -json lambda_urls 2>/dev/null || echo "{}")
FUNCTION_NAME=$(echo "$LAMBDA_URLS" | jq -r 'keys[] | select(contains("-api-"))' | head -1)
REGION=$(echo "$LAMBDA_URLS" | jq -r --arg f "$FUNCTION_NAME" '.[$f] // ""' | sed -nE 's#.*lambda-url\.([a-z0-9-]+)\.on\.aws.*#\1#p')

if [ -z "$FUNCTION_NAME" ] || [ -z "$REGION" ]; then
    echo "ERROR: Could not find the api Lambda in Terraform outputs"
    echo "INFO: Make sure the backend is deployed first: ./bin/deploy-backend.sh"
    exit 1
fi

OUTPUT=$(mktemp)
trap 'rm -f "$OUTPUT"' EXIT

aws lambda invoke \
    --region "$REGION" \
    --function-name "$FUNCTION_NAME" \
    --cli-binary-format raw-in-base64-out \
    --cli-read-timeout 120 \
    --payload "$(jq -n --arg email "$1" '{make_admin: $email}')" \
    "$OUTPUT" > /dev/null

if jq -e '.user' "$OUTPUT" > /dev/null; then
    jq -r '.user | "INFO: \(.email) (\(.full_name)) is now an admin. Sign out and back in to see the admin console."' "$OUTPUT"
else
    echo "ERROR: $(jq -r '.error // .errorMessage // .' "$OUTPUT")"
    exit 1
fi
