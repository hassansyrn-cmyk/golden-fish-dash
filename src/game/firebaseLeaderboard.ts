import { initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { LeaderboardEntry } from './types';

const firebaseConfig = {
  apiKey: "AIzaSyBTG7t03h7HRu5Oj-5-6dwtfatW3fKF6r4",
  authDomain: "golden-fish-rush.firebaseapp.com",
  projectId: "golden-fish-rush",
  storageBucket: "golden-fish-rush.firebasestorage.app",
  messagingSenderId: "1027256518124",
  appId: "1:1027256518124:web:7a02ced2a809415ad46cc9",
  measurementId: "G-96PMWLEXYY"
};

let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;

function initializeFirebaseSafely(): { app: FirebaseApp; db: Firestore } {
  if (!firebaseApp) {
    firebaseApp = initializeApp(firebaseConfig);
    firestoreDb = getFirestore(firebaseApp);
  }
  return { app: firebaseApp, db: firestoreDb! };
}

export async function submitLeaderboardScore(name: string, score: number): Promise<void> {
  if (!name || name.trim().length === 0) {
    throw new Error('Name is required');
  }
  if (score < 0) {
    throw new Error('Score must be non-negative');
  }

  try {
    const { db } = initializeFirebaseSafely();
    const leaderboardCollection = collection(db, 'leaderboard');
    await addDoc(leaderboardCollection, {
      name: name.trim().slice(0, 16),
      score: Math.floor(score),
      createdAt: serverTimestamp()
    });
  } catch (error) {
    console.error('[Firebase] Failed to submit leaderboard score:', error);
    throw error;
  }
}

export async function fetchGlobalLeaderboard(limitCount: number = 10): Promise<LeaderboardEntry[]> {
  const safeLimit = Math.min(Math.max(1, limitCount || 10), 50);

  try {
    const { db } = initializeFirebaseSafely();
    const leaderboardCollection = collection(db, 'leaderboard');
    const q = query(
      leaderboardCollection,
      orderBy('score', 'desc'),
      limit(safeLimit)
    );
    const querySnapshot = await getDocs(q);

    const entries: LeaderboardEntry[] = [];
    const nowDate = new Date().toISOString().slice(0, 10);

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const createdAtValue = data.createdAt;
      let dateStr = nowDate;
      if (createdAtValue instanceof Timestamp) {
        dateStr = createdAtValue.toDate().toISOString().slice(0, 10);
      } else if (createdAtValue && typeof createdAtValue === 'object' && 'seconds' in createdAtValue) {
        dateStr = new Date(createdAtValue.seconds * 1000).toISOString().slice(0, 10);
      }

      entries.push({
        name: typeof data.name === 'string' ? data.name.slice(0, 16) : 'Anonymous',
        score: typeof data.score === 'number' ? data.score : 0,
        date: dateStr
      });
    });

    return entries;
  } catch (error) {
    console.error('[Firebase] Failed to fetch global leaderboard:', error);
    throw error;
  }
}
