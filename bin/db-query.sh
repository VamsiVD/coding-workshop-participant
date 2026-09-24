#!/usr/bin/env bash
# Script: Run SQL Against Aurora
# Purpose: Execute a query on the deployed Aurora database through the RDS Data API
# Usage: ./db-query.sh "SELECT ..."   or   ./db-query.sh < file.sql

set -e

# Usage helper
if [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
    echo "Usage: $0 \"SQL\""
    echo "       $0 < file.sql"
    echo "Run one SQL statement against the deployed Aurora database"
    echo ""
    echo "Description:"
    echo "  Uses the RDS Data API over HTTPS, so no network access to the"
    echo "  database is needed. Results print as JSON, one object per row."
    echo "  Needs rds-data:ExecuteStatement on the cluster for your AWS role."
    echo ""
    echo "Options:"
    echo "  -h, --help      Show this help message"
    echo ""
    echo "Requirements:"
    echo "  - aws cli and terraform installed"
    echo "  - Backend infrastructure deployed (./bin/deploy-backend.sh)"
    echo ""
    echo "Examples:"
    echo "  $0 \"SELECT id, email, role FROM users\""
    echo "  $0 \"SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'\""
    exit 0
fi

# Verify required dependencies
aws --version > /dev/null 2>&1 || { echo "ERROR: 'aws' is missing. Aborting..."; exit 1; }
terraform --version > /dev/null 2>&1 || { echo "ERROR: 'terraform' is missing. Aborting..."; exit 1; }

# Resolve script directory and project root paths
SCRIPT_DIR="$(cd "$(dirname "$0")" > /dev/null 2>&1 || exit 1; pwd -P)"
PROJECT_ROOT="$(cd $SCRIPT_DIR/.. > /dev/null 2>&1 || exit 1; pwd -P)"
ENVIRONMENT_CONFIG="$PROJECT_ROOT/ENVIRONMENT.config"
INFRA_DIR="$PROJECT_ROOT/infra"

# SQL from the argument, or from stdin when none is given
SQL="$1"
if [ -z "$SQL" ] && [ ! -t 0 ]; then
    SQL="$(cat)"
fi
if [ -z "$SQL" ]; then
    echo "ERROR: No SQL given. Run '$0 --help' for usage."
    exit 1
fi

# Load participant credentials; refresh them if they have expired
if [ -f "$ENVIRONMENT_CONFIG" ]; then
    source "$ENVIRONMENT_CONFIG"
fi
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    $SCRIPT_DIR/setup-participant.sh > /dev/null
    source "$ENVIRONMENT_CONFIG"
fi

# Read the cluster and secret from Terraform outputs
cd "$INFRA_DIR"
CLUSTER_ARN=$(terraform output -raw rds_cluster_arn 2>/dev/null || echo "")
SECRET_ARN=$(terraform output -raw rds_secret_arn 2>/dev/null || echo "")
DATABASE=$(terraform output -raw rds_database_name 2>/dev/null || echo "")

if [ -z "$CLUSTER_ARN" ] || [ -z "$SECRET_ARN" ]; then
    echo "ERROR: Could not get the Aurora cluster or secret from Terraform outputs"
    echo "INFO: Make sure the backend is deployed first: ./bin/deploy-backend.sh"
    exit 1
fi

# Region comes from the cluster ARN (arn:aws:rds:<region>:...)
REGION=$(echo "$CLUSTER_ARN" | cut -d: -f4)

aws rds-data execute-statement \
    --region "$REGION" \
    --resource-arn "$CLUSTER_ARN" \
    --secret-arn "$SECRET_ARN" \
    --database "$DATABASE" \
    --format-records-as JSON \
    --sql "$SQL" \
    --query 'formattedRecords || join(``, [`updated rows: `, to_string(numberOfRecordsUpdated)])' \
    --output text
