import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Get Firestore and Storage instances
const db = admin.firestore();
const storage = admin.storage();

/**
 * Cloud Function: Cleanup user data when account is deleted
 * Triggered when a user is deleted from Firebase Authentication
 */
export const onUserDeleted = functions.auth.user().onDelete(async (user) => {
  const userId = user.uid;

  try {
    console.log(`Cleaning up data for deleted user: ${userId}`);

    // Delete user document
    await db.collection('users').doc(userId).delete();

    // Delete all user's compositions
    const compositionsSnapshot = await db
      .collection('compositions')
      .where('userId', '==', userId)
      .get();

    const deletePromises: Promise<any>[] = [];

    compositionsSnapshot.forEach((doc) => {
      deletePromises.push(doc.ref.delete());
    });

    // Delete all user's recordings
    const recordingsSnapshot = await db
      .collection('recordings')
      .where('userId', '==', userId)
      .get();

    recordingsSnapshot.forEach((doc) => {
      const data = doc.data();
      // Delete audio file from storage
      if (data.audioUrl) {
        const filePath = `recordings/${userId}/${doc.id}/audio`;
        deletePromises.push(
          storage.bucket().file(filePath).delete().catch(() => {
            console.log(`File not found or already deleted: ${filePath}`);
          })
        );
      }
      deletePromises.push(doc.ref.delete());
    });

    // Delete all user's practice sessions
    const sessionsSnapshot = await db
      .collection('practiceSessions')
      .where('userId', '==', userId)
      .get();

    sessionsSnapshot.forEach((doc) => {
      deletePromises.push(doc.ref.delete());
    });

    // Delete user's analytics
    const analyticsDoc = db.collection('analytics').doc(userId);
    deletePromises.push(analyticsDoc.delete());

    // Delete user's storage files
    const bucket = storage.bucket();
    deletePromises.push(
      bucket.deleteFiles({
        prefix: `users/${userId}/`
      }).catch(() => {
        console.log(`No files found for user: ${userId}`);
      })
    );

    deletePromises.push(
      bucket.deleteFiles({
        prefix: `recordings/${userId}/`
      }).catch(() => {
        console.log(`No recordings found for user: ${userId}`);
      })
    );

    deletePromises.push(
      bucket.deleteFiles({
        prefix: `exports/${userId}/`
      }).catch(() => {
        console.log(`No exports found for user: ${userId}`);
      })
    );

    await Promise.all(deletePromises);

    console.log(`Successfully cleaned up data for user: ${userId}`);
    return null;
  } catch (error) {
    console.error(`Error cleaning up user ${userId}:`, error);
    throw error;
  }
});

/**
 * Cloud Function: Cleanup old temporary files
 * Scheduled to run daily at midnight
 */
export const cleanupTempFiles = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    try {
      const bucket = storage.bucket();
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;

      const [files] = await bucket.getFiles({
        prefix: 'temp/'
      });

      const deletePromises = files
        .filter((file) => {
          const metadata = file.metadata;
          const created = new Date(metadata.timeCreated).getTime();
          return created < oneDayAgo;
        })
        .map((file) => file.delete());

      await Promise.all(deletePromises);

      console.log(`Deleted ${deletePromises.length} temporary files`);
      return null;
    } catch (error) {
      console.error('Error cleaning up temp files:', error);
      throw error;
    }
  });

/**
 * Cloud Function: Update composition version on edit
 * Triggered when a composition is updated
 */
export const onCompositionUpdate = functions.firestore
  .document('compositions/{compositionId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const compositionId = context.params.compositionId;

    try {
      // Only create version if grid data changed
      if (JSON.stringify(before.grid) !== JSON.stringify(after.grid)) {
        const versionRef = db
          .collection('compositions')
          .doc(compositionId)
          .collection('versions')
          .doc();

        await versionRef.set({
          versionNumber: before.version,
          grid: before.grid,
          layers: before.layers,
          lyrics: before.lyrics,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          createdBy: after.userId,
          changeDescription: 'Auto-saved version'
        });

        console.log(`Created version for composition: ${compositionId}`);
      }

      return null;
    } catch (error) {
      console.error(`Error creating version for composition ${compositionId}:`, error);
      return null; // Don't fail the update if versioning fails
    }
  });

/**
 * Cloud Function: Generate share link
 * Callable function to generate secure share links
 */
export const generateShareLink = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to generate share links'
    );
  }

  const { compositionId, accessLevel, expiresIn, password } = data;

  if (!compositionId || !accessLevel) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'compositionId and accessLevel are required'
    );
  }

  try {
    // Verify user owns the composition
    const compositionRef = db.collection('compositions').doc(compositionId);
    const compositionDoc = await compositionRef.get();

    if (!compositionDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Composition not found');
    }

    const compositionData = compositionDoc.data();
    if (compositionData?.userId !== context.auth.uid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'You do not have permission to share this composition'
      );
    }

    // Generate share link
    const linkId = `link_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresAt = expiresIn
      ? new Date(Date.now() + expiresIn)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // Default 30 days

    const shareLinkRef = db.collection('shareLinks').doc(linkId);
    await shareLinkRef.set({
      compositionId,
      createdBy: context.auth.uid,
      accessLevel,
      expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
      password: password || null,
      accessCount: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return {
      linkId,
      url: `https://swaralipi.app/share/${linkId}`,
      expiresAt: expiresAt.toISOString()
    };
  } catch (error) {
    console.error('Error generating share link:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to generate share link');
  }
});

/**
 * Cloud Function: Record share link access
 */
export const recordShareLinkAccess = functions.https.onCall(async (data, context) => {
  const { linkId } = data;

  if (!linkId) {
    throw new functions.https.HttpsError('invalid-argument', 'linkId is required');
  }

  try {
    const linkRef = db.collection('shareLinks').doc(linkId);
    const linkDoc = await linkRef.get();

    if (!linkDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Share link not found');
    }

    const linkData = linkDoc.data();

    // Check if link has expired
    if (linkData?.expiresAt && linkData.expiresAt.toDate() < new Date()) {
      throw new functions.https.HttpsError('permission-denied', 'Share link has expired');
    }

    // Increment access count
    await linkRef.update({
      accessCount: admin.firestore.FieldValue.increment(1),
      lastAccessedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Get composition data
    const compositionRef = db.collection('compositions').doc(linkData!.compositionId);
    const compositionDoc = await compositionRef.get();

    if (!compositionDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Composition not found');
    }

    return {
      composition: compositionDoc.data(),
      accessLevel: linkData!.accessLevel
    };
  } catch (error) {
    console.error('Error recording share link access:', error);
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    throw new functions.https.HttpsError('internal', 'Failed to access share link');
  }
});

/**
 * Cloud Function: Aggregate practice analytics
 * Scheduled to run daily to aggregate practice session data
 */
export const aggregatePracticeAnalytics = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async () => {
    try {
      const usersSnapshot = await db.collection('users').get();

      const aggregationPromises = usersSnapshot.docs.map(async (userDoc) => {
        const userId = userDoc.id;
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

        // Get recent practice sessions
        const sessionsSnapshot = await db
          .collection('practiceSessions')
          .where('userId', '==', userId)
          .where('startedAt', '>=', sevenDaysAgo)
          .get();

        if (sessionsSnapshot.empty) {
          return;
        }

        let totalDuration = 0;
        let totalScore = 0;
        let totalMistakes = 0;
        const compositionsMap = new Map<string, number>();

        sessionsSnapshot.forEach((doc) => {
          const session = doc.data();
          totalDuration += session.duration || 0;
          totalScore += session.score || 0;
          totalMistakes += session.mistakes?.length || 0;

          const count = compositionsMap.get(session.compositionId) || 0;
          compositionsMap.set(session.compositionId, count + 1);
        });

        const sessionCount = sessionsSnapshot.size;
        const averageScore = sessionCount > 0 ? totalScore / sessionCount : 0;

        // Most practiced composition
        let mostPracticedComposition = '';
        let maxPracticeCount = 0;
        compositionsMap.forEach((count, compositionId) => {
          if (count > maxPracticeCount) {
            maxPracticeCount = count;
            mostPracticedComposition = compositionId;
          }
        });

        // Update analytics document
        const analyticsRef = db.collection('analytics').doc(userId);
        await analyticsRef.set(
          {
            last7Days: {
              sessionCount,
              totalDuration,
              averageScore,
              totalMistakes,
              mostPracticedComposition,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }
          },
          { merge: true }
        );
      });

      await Promise.all(aggregationPromises);

      console.log(`Aggregated analytics for ${usersSnapshot.size} users`);
      return null;
    } catch (error) {
      console.error('Error aggregating practice analytics:', error);
      throw error;
    }
  });

/**
 * Cloud Function: Send welcome email on user creation
 * Triggered when a new user is created
 */
export const onUserCreated = functions.auth.user().onCreate(async (user) => {
  try {
    console.log(`New user created: ${user.email}`);

    // Initialize user document if not exists
    const userRef = db.collection('users').doc(user.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      await userRef.set({
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split('@')[0] || 'User',
        photoURL: user.photoURL || null,
        emailVerified: user.emailVerified,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
        compositionCount: 0,
        recordingCount: 0,
        storageUsed: 0,
        preferences: {
          theme: 'light',
          language: 'hindi',
          autoSave: true,
          defaultTaal: 'teen',
          defaultTempo: 120,
          notificationSettings: {
            email: true,
            collaboration: true,
            comments: true
          }
        }
      });

      console.log(`Created user document for: ${user.uid}`);
    }

    // Note: Email sending would require additional setup (SendGrid, etc.)
    // For free tier, we skip email service integration

    return null;
  } catch (error) {
    console.error(`Error in onUserCreated for ${user.uid}:`, error);
    return null;
  }
});

/**
 * Cloud Function: Monitor storage usage
 * Updates user's storage usage based on their recordings and exports
 */
export const updateStorageUsage = functions.storage.object().onFinalize(async (object) => {
  const filePath = object.name;
  const size = parseInt(object.size || '0', 10);

  if (!filePath) return null;

  try {
    // Extract userId from file path (format: recordings/userId/... or exports/userId/...)
    const pathParts = filePath.split('/');
    if (pathParts.length < 2) return null;

    const category = pathParts[0]; // 'recordings', 'exports', or 'users'
    if (!['recordings', 'exports', 'users'].includes(category)) return null;

    const userId = pathParts[1];
    if (!userId) return null;

    // Update user's storage usage
    const userRef = db.collection('users').doc(userId);
    await userRef.update({
      storageUsed: admin.firestore.FieldValue.increment(size)
    });

    console.log(`Updated storage usage for user ${userId}: +${size} bytes`);

    return null;
  } catch (error) {
    console.error('Error updating storage usage:', error);
    return null;
  }
});

/**
 * Cloud Function: Monitor storage deletion
 * Updates user's storage usage when files are deleted
 */
export const updateStorageOnDelete = functions.storage.object().onDelete(async (object) => {
  const filePath = object.name;
  const size = parseInt(object.size || '0', 10);

  if (!filePath) return null;

  try {
    const pathParts = filePath.split('/');
    if (pathParts.length < 2) return null;

    const category = pathParts[0];
    if (!['recordings', 'exports', 'users'].includes(category)) return null;

    const userId = pathParts[1];
    if (!userId) return null;

    // Update user's storage usage
    const userRef = db.collection('users').doc(userId);
    await userRef.update({
      storageUsed: admin.firestore.FieldValue.increment(-size)
    });

    console.log(`Updated storage usage for user ${userId}: -${size} bytes`);

    return null;
  } catch (error) {
    console.error('Error updating storage on delete:', error);
    return null;
  }
});
