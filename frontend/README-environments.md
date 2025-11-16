# Frontend Account Environments

This document explains how to manage environment configurations and builds for different AWS accounts.

## Environment File Structure

The frontend uses account-specific environment files to support deployments to different AWS accounts:

```
frontend/
├── .env.example                 # Template for creating new account configs
├── .env.831926593673           # BTB account configuration
├── .env.602223306405           # HT account configuration
├── .env.development.local      # Local development (gitignored)
└── .gitignore                  # Configured to allow account-specific files
```

## Environment File Format

Each account-specific environment file (`.env.[account-id]`) contains:

```properties
# Account: [Account Name/Description]
# Environment: [Production/Staging/etc]

VITE_USER_POOL_ID=us-west-2_xxxxxxxxx
VITE_USER_POOL_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_GRAPHQL_ENDPOINT=https://xxxxxxxxxx.appsync-api.us-west-2.amazonaws.com/graphql
VITE_AWS_REGION=us-west-2

# Optional: Account-specific configuration
# VITE_CUSTOM_DOMAIN=example.com
# VITE_ENVIRONMENT_NAME=production
```

## Build Commands

### Account-Specific Builds

Build for a specific AWS account:

```bash
npm run build:account [account-id]
```

Examples:
```bash
# Build for BTB account
npm run build:account 831926593673

# Build for HT account
npm run build:account 602223306405
```

### Build Output

Account-specific builds are generated in separate directories:

```
frontend/dist/
├── 831926593673/          # BTB account build
│   ├── index.html
│   ├── assets/
│   └── ...
└── 602223306405/          # HT account build
    ├── index.html
    ├── assets/
    └── ...
```

### Clean Builds

Remove all build directories:

```bash
npm run build:clean
```

## Development

For local development, create a `.env.development.local` file with your development configuration. This file is gitignored and won't interfere with account-specific builds.

## Deployment Integration

The CDK deployment automatically uses the correct build directory based on the target account:

- When deploying to account `831926593673`, CDK uses `frontend/dist/831926593673/`
- When deploying to account `602223306405`, CDK uses `frontend/dist/602223306405/`

## Adding New Accounts

To add support for a new AWS account:

1. Create a new environment file: `.env.[new-account-id]`
2. Copy the template from `.env.example`
3. Fill in the account-specific values from CDK outputs
4. Test the build: `npm run build:account [new-account-id]`

## Error Handling

The build system validates:

- **Account ID format**: Must be a 12-digit number
- **Environment file exists**: Must have `.env.[account-id]` file
- **Build directory**: Creates account-specific output directory

Common errors:

```bash
# Invalid account ID format
npm run build:account invalid-account
# Error: Invalid account ID format: invalid-account. Account ID must be a 12-digit number.

# Missing environment file
npm run build:account 999999999999
# Error: Environment file .env.999999999999 not found. Please create this file...
```

## Migration from Single .env

If migrating from a single `.env` file:

1. Create account-specific files from the original `.env`
2. Remove the original `.env` file (it's now gitignored)
3. Update deployment scripts to use account-specific builds
4. Test builds for all accounts

## Troubleshooting

### Build fails with "Environment file not found"
- Ensure `.env.[account-id]` file exists
- Check that account ID is exactly 12 digits
- Verify file contains all required VITE_ variables

### Wrong configuration loaded
- Verify you're using the correct account ID in the build command
- Check that the environment file contains the expected values
- Ensure no conflicting `.env` file exists

### CDK deployment fails
- Ensure you've built for the correct account before deploying
- Verify the build directory `dist/[account-id]/` exists and contains files
- Check that CDK is deploying to the same account used in the build command