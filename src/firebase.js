
// src/firebase.js

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// ✅ Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCWw-I6mxAkJ1Q0Gt_wP1Bge-N0o-7MePU",
  authDomain: "sample-firebase-ai-app-c8afb.firebaseapp.com",
  projectId: "sample-firebase-ai-app-c8afb",
  storageBucket: "sample-firebase-ai-app-c8afb.appspot.com", // 🔧 fixed from .app to .appspot.com
  messagingSenderId: "221369775323",
  appId: "1:221369775323:web:c05d3eb4f88d1278d348fe"
};

// ✅ Initialize Firebase app
const app = initializeApp(firebaseConfig);

// ✅ Export auth and firestore
export const auth = getAuth(app);
export const db = getFirestore(app);
