importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js");

// Initialize Firebase App inside Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyDKKufKzHz28QphexxvOb1D7IPLXtYdqcs",
  authDomain: "daffgle.firebaseapp.com",
  projectId: "daffgle",
  storageBucket: "daffgle.firebasestorage.app",
  messagingSenderId: "346590814898",
  appId: "1:346590814898:web:bdf239228c1e4898a51fab",
});

const messaging = firebase.messaging();

// Simple background receiver message listener
messaging.onBackgroundMessage((payload) => {
  console.log("Received background message: ", payload);

  const notificationTitle = payload.notification.title || "Daffgle";
  const notificationOptions = {
    body: payload.notification.body || "New anonymous message!",
    icon: "/globe.svg",
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
