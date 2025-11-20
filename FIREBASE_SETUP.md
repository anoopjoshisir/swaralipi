# Firebase Backend Setup Guide

This guide will help you set up the complete production-ready Firebase backend for Swaralipi.

## Prerequisites

- Node.js (v20 or higher)
- npm or yarn
- Firebase CLI (`npm install -g firebase-tools`)
- A Google account

## Step 1: Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add Project"
3. Enter project name: `swaralipi` (or your preferred name)
4. **Important**: Disable Google Analytics (to stay within free tier limits)
5. Click "Create Project"

## Step 2: Enable Firebase Services

### Enable Authentication

1. In Firebase Console, go to **Authentication** → **Sign-in method**
2. Enable **Email/Password**
   - Turn on "Email/Password"
   - Click "Save"
3. Enable **Google**
   - Turn on "Google"
   - Set support email
   - Click "Save"

### Enable Firestore Database

1. Go to **Firestore Database**
2. Click "Create database"
3. **Start in production mode** (we'll deploy security rules)
4. Choose location: `us-central1` (or closest to your users)
   - **Important**: Choose wisely, location cannot be changed later
5. Click "Enable"

### Enable Cloud Storage

1. Go to **Storage**
2. Click "Get started"
3. **Start in production mode**
4. Use same location as Firestore
5. Click "Done"

### Enable Cloud Functions

1. Go to **Functions**
2. Click "Get started"
3. Upgrade to **Blaze (pay as you go)** plan
   - **Don't worry**: We've configured everything to stay within free tier
   - Free tier: 2M invocations/month, 400K GB-seconds, 200K CPU-seconds
4. Click "Continue"

## Step 3: Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll down to "Your apps"
3. Click **Web** icon (</>) to add a web app
4. Register app with nickname: "Swaralipi Web App"
5. **Don't enable Firebase Hosting yet**
6. Copy the configuration object that appears:

\`\`\`javascript
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456:web:abcdef",
  measurementId: "G-XXXXXXXXXX"
};
\`\`\`

## Step 4: Configure Your Project

### Update Environment Files

1. Open `swaralipi-app/src/environments/environment.ts`
2. Replace the Firebase configuration:

\`\`\`typescript
export const environment = {
  production: false,
  firebase: {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
  },
  // ... rest of config
};
\`\`\`

3. Update `swaralipi-app/src/environments/environment.prod.ts` with the same config
4. Update `.firebaserc` in the root directory:

\`\`\`json
{
  "projects": {
    "default": "YOUR_PROJECT_ID"
  }
}
\`\`\`

## Step 5: Install Dependencies

### Install App Dependencies

\`\`\`bash
cd swaralipi-app
npm install
\`\`\`

### Install Functions Dependencies

\`\`\`bash
cd ../functions
npm install
\`\`\`

## Step 6: Deploy to Firebase

### Login to Firebase

\`\`\`bash
firebase login
\`\`\`

### Deploy Security Rules

\`\`\`bash
# From project root directory
firebase deploy --only firestore:rules,storage:rules
\`\`\`

### Deploy Firestore Indexes

\`\`\`bash
firebase deploy --only firestore:indexes
\`\`\`

### Deploy Cloud Functions

\`\`\`bash
cd functions
npm run build
cd ..
firebase deploy --only functions
\`\`\`

**Note**: First deployment may take 5-10 minutes.

### Build and Deploy Web App

\`\`\`bash
cd swaralipi-app
npm run build
cd ..
firebase deploy --only hosting
\`\`\`

## Step 7: Configure Firebase Hosting (Optional)

If you want a custom domain:

1. In Firebase Console, go to **Hosting**
2. Click "Add custom domain"
3. Enter your domain (e.g., `swaralipi.app`)
4. Follow DNS configuration instructions
5. Wait for SSL certificate provisioning (usually 24-48 hours)

## Step 8: Test Your Deployment

1. Open your app: `https://YOUR_PROJECT.web.app`
2. Test authentication:
   - Sign up with email/password
   - Sign in with Google
3. Test composition features:
   - Create a composition
   - Save to cloud
   - Verify real-time sync
4. Test file upload:
   - Record audio (if available)
   - Export composition as PDF

## Firestore Data Structure

Your Firestore database will have these collections:

\`\`\`
/users/{userId}
  - uid: string
  - email: string
  - displayName: string
  - photoURL: string | null
  - emailVerified: boolean
  - createdAt: timestamp
  - lastLoginAt: timestamp
  - compositionCount: number
  - recordingCount: number
  - storageUsed: number
  - preferences: object

/compositions/{compositionId}
  - userId: string
  - title: string
  - grid: object (notation data)
  - layers: array | null
  - lyrics: object | null
  - metadata: object
  - createdAt: timestamp
  - updatedAt: timestamp
  - isPublic: boolean
  - sharedWith: array of userIds
  - tags: array of strings
  - version: number

  /compositions/{compositionId}/versions/{versionId}
    - versionNumber: number
    - grid: object
    - layers: array | null
    - lyrics: object | null
    - createdAt: timestamp
    - createdBy: string (userId)
    - changeDescription: string

  /compositions/{compositionId}/comments/{commentId}
    - userId: string
    - userName: string
    - text: string
    - cellPosition: object | null
    - createdAt: timestamp
    - replies: array
    - resolved: boolean

/recordings/{recordingId}
  - userId: string
  - compositionId: string
  - title: string
  - audioUrl: string
  - duration: number
  - createdAt: timestamp
  - waveformData: array | null

/practiceSessions/{sessionId}
  - userId: string
  - compositionId: string
  - startedAt: timestamp
  - endedAt: timestamp
  - duration: number
  - tempo: number
  - mistakes: array
  - score: number

/analytics/{userId}
  - last7Days: object
    - sessionCount: number
    - totalDuration: number
    - averageScore: number
    - totalMistakes: number
    - mostPracticedComposition: string
    - updatedAt: timestamp

/shareLinks/{linkId}
  - compositionId: string
  - createdBy: string (userId)
  - accessLevel: 'view' | 'comment' | 'edit'
  - expiresAt: timestamp
  - password: string | null
  - accessCount: number
  - createdAt: timestamp
  - lastAccessedAt: timestamp | null

/presence/{compositionId}/users/{userId}
  - userId: string
  - userName: string
  - currentCell: object
  - color: string
  - lastActive: timestamp
\`\`\`

## Storage Structure

Your Cloud Storage will have this structure:

\`\`\`
/users/{userId}/profile/{filename}
  - User profile images (5MB max)

/recordings/{userId}/{recordingId}/{filename}
  - Audio recordings (5MB max per file)

/exports/{userId}/{compositionId}/{filename}
  - Exported PDFs, PNGs, MIDI files (10MB max)

/temp/{userId}/{filename}
  - Temporary files (auto-deleted after 24 hours)
\`\`\`

## Free Tier Limits

The application is configured to stay within Firebase free tier:

### Firestore
- **Storage**: 1 GiB
- **Reads**: 50K/day
- **Writes**: 20K/day
- **Deletes**: 20K/day

**Our limits**:
- Max 50 compositions per user
- Max 20 versions per composition
- Real-time listeners optimized

### Cloud Storage
- **Storage**: 5 GB
- **Downloads**: 1 GB/day
- **Uploads**: Unlimited
- **Operations**: 50K/day

**Our limits**:
- Max 5MB per recording
- Max 20 recordings per user
- Total ~100MB per user

### Authentication
- **Users**: Unlimited

### Cloud Functions
- **Invocations**: 2M/month (125K/month for free tier)
- **GB-seconds**: 400K/month
- **CPU-seconds**: 200K/month

**Our optimizations**:
- Efficient triggers
- Batched operations
- Scheduled cleanups

### Hosting
- **Storage**: 10 GB
- **Transfer**: 360 MB/day

## Monitoring Usage

### Firebase Console

1. Go to **Usage and billing**
2. Monitor daily usage
3. Set up budget alerts (recommended: $5/month alert)

### Enable Usage Alerts

1. Go to **Project Settings** → **Usage and billing**
2. Click "Set budget alert"
3. Set threshold: $1 or $5
4. Add your email

## Troubleshooting

### Functions Deployment Fails

\`\`\`bash
# Check Node version
node --version  # Should be 20.x

# Clear and rebuild
cd functions
rm -rf node_modules lib
npm install
npm run build
cd ..
firebase deploy --only functions
\`\`\`

### Firestore Rules Not Working

\`\`\`bash
# Redeploy rules
firebase deploy --only firestore:rules

# Test rules in Firebase Console
# Go to Firestore → Rules → Simulator
\`\`\`

### App Can't Connect to Firebase

1. Check browser console for errors
2. Verify API key in environment files
3. Check Firebase project is enabled
4. Verify domain is authorized in Firebase Console:
   - **Authentication** → **Settings** → **Authorized domains**

### Storage Upload Fails

1. Check Storage rules are deployed
2. Verify file size limits
3. Check user is authenticated
4. Look for errors in browser console

## Security Best Practices

1. **Never commit** `environment.ts` or `environment.prod.ts` with real API keys to public repos
2. Use environment variables in CI/CD
3. Enable **App Check** for production (prevents abuse)
4. Regularly review **Authentication** → **Users** for suspicious accounts
5. Monitor **Functions** logs for errors
6. Set up **Budget Alerts** to prevent unexpected charges

## Backup Strategy

### Manual Backup

\`\`\`bash
# Export Firestore data
npm install -g node-firestore-backup-restore
firestore-export --accountCredentials path/to/credentials.json --backupFile backup.json

# Export Storage files
gsutil -m rsync -r gs://YOUR_PROJECT.appspot.com ./storage-backup
\`\`\`

### Automated Backup (Optional)

Set up a Cloud Function to export Firestore weekly:
- Uses Firestore managed export
- Stores in Cloud Storage
- Runs on schedule

## Next Steps

1. ✅ Test all features thoroughly
2. ✅ Set up monitoring and alerts
3. ✅ Configure custom domain (optional)
4. ✅ Enable App Check for production
5. ✅ Set up error tracking (Sentry, LogRocket)
6. ✅ Configure SEO and meta tags
7. ✅ Add analytics (Google Analytics 4)

## Support

- Firebase Documentation: https://firebase.google.com/docs
- Firebase Community: https://firebase.google.com/community
- Stack Overflow: Tag `firebase`

## Cost Optimization Tips

1. **Use client-side filtering** instead of Firestore queries where possible
2. **Cache data** using service workers
3. **Batch operations** instead of individual writes
4. **Use Cloud Functions sparingly** - prefer client-side logic
5. **Compress images** before upload
6. **Clean up unused data** regularly
7. **Monitor usage** weekly

---

**Congratulations!** 🎉

Your Swaralipi backend is now fully deployed and production-ready on Firebase!
