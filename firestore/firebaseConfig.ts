import { initializeApp } from 'firebase/app';
import { Firestore, getFirestore } from 'firebase/firestore';
import { Auth, getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: <api_key_to_add>,
    authDomain: <auth_domain_to_add>,
    projectId: <project_id_to_add>,
    storageBucket: <storage_bucket_to_add>,
    messagingSenderId: <message_sender_id_to_add>,
    appId: <app_id_to_add>
  };

const app = initializeApp(firebaseConfig);
const db: Firestore = getFirestore(app);
const auth: Auth = getAuth(app);

export { db, auth };