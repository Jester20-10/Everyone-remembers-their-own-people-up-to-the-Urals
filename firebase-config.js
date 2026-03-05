import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyAeZ6DhK-0zECEZlnmwKT6XSFlgHLd7K-w",
  authDomain: "ural-memory-admin.firebaseapp.com",
  projectId: "ural-memory-admin",
  storageBucket: "ural-memory-admin.firebasestorage.app",
  messagingSenderId: "718188133112",
  appId: "1:718188133112:web:20994a8d9117ab6ea4590d",
  measurementId: "G-NR9ZRQ18S6"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
