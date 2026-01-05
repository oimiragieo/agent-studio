# Infrastructure Configuration: {{project_name}}

## Metadata
- **Project**: {{project_name}}
- **Environment**: {{environment}} (development/staging/production)
- **Cloud Provider**: {{cloud_provider}} (gcp/aws/azure)
- **Created**: {{created_date}}
- **Last Modified**: {{last_modified}}

## Resource Naming Conventions

**CRITICAL: Cloud resource names must be globally unique (especially GCP buckets, which are globally unique across all Google customers).**

**Pattern**: `{project}-{resource-type}-{environment}-{unique_suffix}`

**Unique Suffix Generation**:
- Append a unique suffix to prevent global namespace collisions
- Strategies: `unique_hash` (recommended), `project_id`, `uuid`, `deterministic`
- Default: 6-8 character hash from `project_id + resource_type + timestamp`

**Examples**:
- Storage bucket: `{{project_name}}-assets-{{environment}}-a3f2b1c` (with unique suffix `a3f2b1c`)
- Cloud Run service: `{{project_name}}-api-{{environment}}-x7k9m2n`
- Cloud SQL instance: `{{project_name}}-db-{{environment}}-p4q8r5s`
- Service account: `{{project_name}}-sa-{{environment}}-t1w3y6z`

**GCP Naming Constraints**:
- **Storage Buckets**: 3-63 characters, lowercase, alphanumeric and hyphens only, globally unique
- **Cloud SQL**: 1-98 characters, alphanumeric and hyphens, globally unique per project
- **Cloud Run**: 1-63 characters, lowercase, alphanumeric and hyphens
- **Pub/Sub Topics**: 1-255 characters, alphanumeric and hyphens

**Resource Definition Format**:
```json
{
  "name": "myapp-assets-dev-a3f2b1c",
  "unique_suffix": "a3f2b1c",
  "naming_strategy": "unique_hash",
  "type": "gcs-bucket"
}
```

## Resource Definitions

### Compute Resources

{{#each compute_resources}}
- **Name**: {{name}}
- **Type**: {{type}}
- **Region**: {{region}}
- **Connection String**: {{connection_string}}
- **Specifications**: {{specifications}}
{{/each}}

### Storage Resources

{{#each storage_resources}}
- **Name**: {{name}}
- **Type**: {{type}}
- **Region**: {{region}}
- **Access Pattern**: {{access_pattern}}
{{/each}}

### Database Resources

{{#each database_resources}}
- **Name**: {{name}}
- **Type**: {{type}}
- **Engine**: {{engine}}
- **Connection String**: {{connection_string}}
- **Region**: {{region}}
{{/each}}

### Networking Resources

{{#each networking_resources}}
- **Name**: {{name}}
- **Type**: {{type}}
- **CIDR**: {{cidr}}
{{/each}}

### Messaging Resources

{{#each messaging_resources}}
- **Name**: {{name}}
- **Type**: {{type}}
- **Region**: {{region}}
{{/each}}

## Environment Variables

**Required for Application Configuration**:

```bash
# Project Configuration
GCP_PROJECT_ID={{project_id}}
ENVIRONMENT={{environment}}

# Storage
STORAGE_BUCKET={{storage_bucket_name}}
STORAGE_REGION={{storage_region}}

# Database
DATABASE_HOST={{database_host}}
DATABASE_NAME={{database_name}}
DATABASE_USER={{database_user}}
# DATABASE_PASSWORD_SECRET_ID - Reference to Secret Manager (never store actual password)
DATABASE_PASSWORD_SECRET_ID={{db_password_secret_id}}

# API Endpoints
API_ENDPOINT={{api_endpoint}}
```

## Service Accounts

{{#each service_accounts}}
### {{name}}

**Roles**:
{{#each roles}}
- {{this}}
{{/each}}

**Key Path** (for local development): `{{key_path}}`

{{/each}}

## API Endpoints

{{#each api_endpoints}}
- **{{@key}}**: {{this}}
{{/each}}

## Terraform Configuration

**Module Path**: `{{terraform_module_path}}`

**Variables**:
```hcl
{{terraform_variables}}
```

## Connection String Formats

### GCP Cloud SQL
```
postgresql://user:pass@/dbname?host=/cloudsql/project:region:instance-name
```

### GCP Storage
```
gs://bucket-name/path/to/file
```

### GCP Pub/Sub
```
projects/{{project_id}}/topics/{{topic_name}}
```

## Local Development (Emulator Configuration)

**For local development, use emulators instead of real cloud resources**:

```bash
# GCP Emulators
export PUBSUB_EMULATOR_HOST=localhost:8085
export DATASTORE_EMULATOR_HOST=localhost:8081
export STORAGE_EMULATOR_HOST=http://localhost:9023

# Database (Testcontainers or local)
export DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

# Disable real cloud credentials
unset GOOGLE_APPLICATION_CREDENTIALS
```

## Production Deployment

**When deploying to production**:
1. Use actual resource names from this configuration
2. Set proper IAM roles and service account permissions
3. Configure environment variables in deployment platform
4. Use secret management for sensitive values (passwords, keys)

## Secrets Management

**CRITICAL: This configuration uses Secret Manager references, NEVER actual secrets.**

### Secret References

All sensitive values (passwords, API keys, tokens) are stored in Secret Manager and referenced here:

{{#each secret_references}}
**{{@key}}**:
- Secret ID: `{{secret_id}}`
- Environment Variable: `{{environment_variable}}`
- Local Development: {{local_development_note}}

{{/each}}

### Connection String Templates

Connection strings use placeholders for secrets:
- Database: `postgresql://user:{DB_PASSWORD}@host/db` (password fetched from Secret Manager at runtime)
- Never include actual passwords in connection strings

### Local Development

For local development:
1. Set secrets in `.env` file (e.g., `DB_PASSWORD=your-local-password`)
2. **NEVER commit `.env` files to git**
3. Application code should check for local `.env` first, then fall back to Secret Manager in production

## Notes

- All resource names follow the naming convention with unique suffixes: `{project}-{resource}-{env}-{unique_suffix}`
- Unique suffixes prevent global namespace collisions (critical for GCP buckets)
- Environment variables are defined in this configuration
- Connection strings use concrete resource names with placeholders for secrets (not actual passwords)
- Secret references point to Secret Manager, never contain actual secrets
- Local development uses emulators; production uses real cloud resources

