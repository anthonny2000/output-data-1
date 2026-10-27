import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { firebaseConfig };

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function parseStructuredFirestoreError(error: unknown): {
  userMessage: string;
  isQuotaError: boolean;
  upgradeUrl?: string;
} {
  const rawMessage = error instanceof Error ? error.message : String(error);
  let innerError = rawMessage;
  try {
    const parsed = JSON.parse(rawMessage) as Partial<FirestoreErrorInfo>;
    if (parsed && typeof parsed.error === 'string') {
      innerError = parsed.error;
    }
  } catch {
    // Non-JSON error string
  }

  if (
    innerError.includes("Quota exceeded for quota metric 'Free daily read units per project (free tier database)'")
  ) {
    const upgradeUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/firestore/databases/${firebaseConfig.firestoreDatabaseId}/data?openUpgradeDialog=true`;
    return {
      isQuotaError: true,
      upgradeUrl,
      userMessage:
        'Quota gratuit quotidien de lectures Firestore atteint. Le quota sera réinitialisé demain (plan Spark gratuit).',
    };
  }

  if (innerError.includes('Quota exceeded')) {
    return {
      isQuotaError: true,
      upgradeUrl: 'https://firebase.google.com/pricing#cloud-firestore',
      userMessage:
        'Quota gratuit Firebase (Spark) atteint pour aujourd’hui. Le quota sera réinitialisé demain.',
    };
  }

  if (innerError.includes('Missing or insufficient permissions')) {
    return {
      isQuotaError: false,
      userMessage:
        'Permissions insuffisantes sur Firestore. Vérifiez que vous êtes bien connecté avec un compte Google vérifié.',
    };
  }

  return {
    isQuotaError: false,
    userMessage: innerError,
  };
}

async function testConnection(): Promise<void> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
