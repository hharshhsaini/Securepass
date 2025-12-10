/**
 * Passport OAuth Configuration
 * Sets up Google and GitHub OAuth strategies
 */

import passport from 'passport';
import { Strategy as GoogleStrategy, Profile as GoogleProfile } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy, Profile as GitHubProfile } from 'passport-github2';
import { findOrCreateOAuthUser } from '../services/authService';

// Type for OAuth callback done function
type DoneCallback = (error: Error | null, user?: Express.User | false) => void;

/**
 * Initialize Google OAuth Strategy
 */
function initGoogleStrategy(): void {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    console.warn('Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
    return;
  }

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
        scope: ['profile', 'email']
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: GoogleProfile,
        done: DoneCallback
      ) => {
        try {
          // Extract email from profile
          const email = profile.emails?.[0]?.value || null;
          const name = profile.displayName || null;

          const result = await findOrCreateOAuthUser(
            'google',
            profile.id,
            email,
            name,
            accessToken,
            refreshToken
          );

          // Pass user and tokens to callback handler
          done(null, result as unknown as Express.User);
        } catch (error) {
          done(error as Error);
        }
      }
    )
  );
}

/**
 * Initialize GitHub OAuth Strategy
 */
function initGitHubStrategy(): void {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    console.warn('GitHub OAuth not configured - missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET');
    return;
  }

  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: process.env.GITHUB_CALLBACK_URL || '/api/auth/github/callback',
        scope: ['user:email']
      },
      async (
        accessToken: string,
        refreshToken: string,
        profile: GitHubProfile,
        done: DoneCallback
      ) => {
        try {
          // GitHub may have multiple emails, get primary or first
          const emails = profile.emails || [];
          const primaryEmail = emails.find(e => (e as { primary?: boolean }).primary)?.value 
            || emails[0]?.value 
            || null;
          const name = profile.displayName || profile.username || null;

          const result = await findOrCreateOAuthUser(
            'github',
            profile.id,
            primaryEmail,
            name,
            accessToken,
            refreshToken
          );

          done(null, result as unknown as Express.User);
        } catch (error) {
          done(error as Error);
        }
      }
    )
  );
}

/**
 * Initialize all passport strategies
 */
export function initializePassport(): void {
  initGoogleStrategy();
  initGitHubStrategy();
}

export default passport;
