# Deployment Setup

This document explains how to set up the deployment workflow for this project.

## GitHub Pages Deployment

This project uses GitHub Actions to automatically deploy to GitHub Pages whenever changes are pushed to the `main` branch. The deployment uses the `gh-pages` npm package to push the built files to a separate repository.

## Prerequisites

### Creating a GitHub Personal Access Token

To deploy to the target GitHub Pages repository, you need to create a Personal Access Token (PAT) with the appropriate permissions:

1. **Go to GitHub Settings**
   - Click your profile picture in the top-right corner
   - Select **Settings**

2. **Navigate to Developer Settings**
   - Scroll down to **Developer settings** in the left sidebar
   - Click **Personal access tokens**
   - Select **Tokens (classic)**

3. **Generate New Token**
   - Click **Generate new token** → **Generate new token (classic)**
   - Give your token a descriptive name (e.g., "GCP Exam Prep Deployment")
   - Set an expiration date (recommended: 90 days or custom)

4. **Select Scopes**
   - Check the **`repo`** scope (this will select all sub-scopes)
   - This grants full control of private repositories, which is needed for deployment

5. **Generate and Copy Token**
   - Click **Generate token** at the bottom
   - **Important**: Copy the token immediately - you won't be able to see it again!

### Adding the Token to Repository Secrets

After creating the Personal Access Token, add it to this repository's secrets:

1. **Go to Repository Settings**
   - Navigate to this repository on GitHub
   - Click **Settings** (you need admin access)

2. **Navigate to Secrets**
   - Click **Secrets and variables** in the left sidebar
   - Select **Actions**

3. **Add New Secret**
   - Click **New repository secret**
   - Name: `GH_PAGES_DEPLOY_TOKEN`
   - Value: Paste the Personal Access Token you created
   - Click **Add secret**

## Deployment Workflow

Once the token is configured, the deployment workflow will:

1. Trigger automatically on push to the `main` branch
2. Install dependencies and build the project
3. Create a 404.html fallback for SPA routing
4. Deploy the built files to the target repository using the token

## Manual Deployment

To deploy manually from your local machine:

1. Ensure you have the token set as an environment variable:
   ```bash
   export GH_PAGES_DEPLOY_TOKEN=your_token_here
   ```

2. Run the deployment script:
   ```bash
   npm run deploy
   ```

   Note: The automated workflow uses a modified version of the deploy command to inject the token for authentication.

## Troubleshooting

### Deployment Fails with Authentication Error

- Verify the `GH_PAGES_DEPLOY_TOKEN` secret is set correctly in repository settings
- Check that the token hasn't expired
- Ensure the token has the `repo` scope
- Verify you have push access to the target repository (`tlfmcooper/github.io`)

### Build Fails

- Check the GitHub Actions logs for specific error messages
- Ensure all dependencies are properly listed in `package.json`
- Test the build locally with `npm run build`

### 404 Errors After Deployment

- Verify the `404.html` file was created during deployment
- Check that the `homepage` field in `package.json` matches your deployment path
- Ensure the base path in your routing matches the deployment subdirectory

## Security Notes

- Never commit the Personal Access Token to the repository
- Rotate tokens regularly (every 90 days recommended)
- Use tokens with the minimum required permissions
- If a token is compromised, revoke it immediately and create a new one
