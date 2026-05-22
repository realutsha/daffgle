import { initializeApp } from "firebase/app";
import { getMessaging, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDKKufKzHz28QphexxvOb1D7IPLXtYdqcs",
  authDomain: "daffgle.firebaseapp.com",
  projectId: "daffgle",
  storageBucket: "daffgle.firebasestorage.app",
  messagingSenderId: "346590814898",
  appId: "1:346590814898:web:bdf239228c1e4898a51fab",
  measurementId: "G-RWVN4VMB59",
};

const firebaseApp = initializeApp(firebaseConfig);

export async function getFirebaseMessaging() {
  const supported = await isSupported();

  if (!supported) return null;

  return getMessaging(firebaseApp);
}