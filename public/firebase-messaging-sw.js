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

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log("[Service Worker] Received background message: ", payload);

  const title = payload.notification?.title || payload.data?.title || "Daffgle";
  const body = payload.notification?.body || payload.data?.body || "New anonymous notification!";
  const clickAction = payload.data?.url || payload.data?.click_action || payload.notification?.click_action || "/";

  const notificationOptions = {
    body: body,
    icon: "/globe.svg",
    badge: "/globe.svg",
    data: {
      url: clickAction
    },
    // Prevent duplicated popups for the same notification event category
    tag: payload.data?.tag || "daffgle-alert",
    renotify: true
  };

  self.registration.showNotification(title, notificationOptions);
});

// Handle notification click with deep-linking & tab-focus control
self.addEventListener("notificationclick", (event) => {
  console.log("[Service Worker] Notification clicked: ", event.notification);
  event.notification.close();

  // Retrieve custom URL from notification metadata
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // 1. If a window is already open, focus it and navigate to the target deep link
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      // 2. If no windows are currently running, open a new browser tab/window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
