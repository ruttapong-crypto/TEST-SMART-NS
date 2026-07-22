import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// ตั้งค่า Firebase ของโปรเจกต์ SmartExam
const firebaseConfig = {
  apiKey: "AIzaSyAzAPUdsGOJfxxfTRpZqSKnkUK_q16_dZI",
  authDomain: "test-ns-smart.firebaseapp.com",
  databaseURL: "https://test-ns-smart-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "test-ns-smart",
  storageBucket: "test-ns-smart.firebasestorage.app",
  messagingSenderId: "215477003452",
  appId: "1:215477003452:web:acf4215ea1876cf7c7dcb9",
  measurementId: "G-VPJFGX4RJZ"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
