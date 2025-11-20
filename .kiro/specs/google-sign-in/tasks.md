# Implementation Plan

- [ ] 1. Set up Google OAuth credentials and configuration
  - Create OAuth 2.0 Client ID in Google Cloud Console
  - Configure authorized redirect URIs for Cognito
  - Add Google credentials to configuration management
  - _Requirements: 3.1, 3.2_

- [ ] 2. Update CDK configuration interface
  - Add Google credentials interface to config.ts
  - Add OAuth callback URLs configuration
  - Update environment-specific config files
  - _Requirements: 3.1, 3.2_

- [ ] 3. Configure Cognito User Pool with Google identity provider
  - Add UserPoolIdentityProviderGoogle construct to CDK stack
  - Configure attribute mapping (email, name, picture)
  - Set OAuth scopes (profile, email, openid)
  - _Requirements: 1.2, 1.3, 3.1_

- [ ] 4. Update Cognito User Pool Client for federated sign-in
  - Add Google to supported identity providers
  - Configure OAuth flows (authorization code grant)
  - Set callback and logout URLs
  - Add dependency on Google provider
  - _Requirements: 1.1, 1.4, 4.2_

- [ ] 5. Update frontend Amplify configuration
  - Add OAuth configuration to amplify-config.ts
  - Configure Cognito domain
  - Set redirect URLs for sign-in and sign-out
  - Add Google to providers list
  - _Requirements: 4.1, 4.2_

- [ ] 6. Add environment variables for frontend
  - Add VITE_COGNITO_DOMAIN to .env files
  - Update .env.example with new variable
  - Document required environment variables
  - _Requirements: 4.1_

- [ ]* 7. Write unit tests for post-confirmation Lambda with Google sign-in
  - Test Lambda handles Google authentication events
  - Test email extraction from Google attributes
  - Test displayName generation from Google profile
  - Test gravatarHash calculation
  - _Requirements: 5.2, 5.3, 5.4_

- [ ]* 8. Write CDK configuration tests
  - Test stack synthesizes with Google IdP
  - Verify User Pool Client includes Google provider
  - Verify OAuth settings are configured
  - _Requirements: 3.1_

- [ ]* 9. Write frontend configuration tests
  - Verify Amplify config includes OAuth settings
  - Verify Google is in providers array
  - Verify callback URLs are set
  - _Requirements: 4.1_

- [ ] 10. Create deployment documentation
  - Document Google OAuth setup steps
  - Document environment variable configuration
  - Document deployment sequence
  - Add troubleshooting guide
  - _Requirements: 3.1, 3.2_

- [ ] 11. Update README with Google Sign-In information
  - Add Google Sign-In to features list
  - Document account linking behavior
  - Add setup instructions for developers
  - _Requirements: 2.1, 2.2, 2.3_
