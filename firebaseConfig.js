// Initialize Firebase
// Replace the placeholders with your Firebase project configuration
if (typeof firebase !== 'undefined') {
  const firebaseConfig = {
  apiKey: "AIzaSyDB0l95P05wQcbJhrw5qqvyToihwlVZ-Us",
  authDomain: "agropecuaria3l-b9bcc.firebaseapp.com",
  projectId: "agropecuaria3l-b9bcc",
  storageBucket: "agropecuaria3l-b9bcc.firebasestorage.app",
  messagingSenderId: "91137815308",
  appId: "1:91137815308:web:c247c909fb1f793b270f29"
  };
  firebase.initializeApp(firebaseConfig);
  // Expose Firestore globally for easy access in app.js
  // Enable offline persistence so the app keeps working without internet
  const db = firebase.firestore();
  db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
    console.warn('Firestore persistence could not be enabled', err);
  });
  window.db = db;
}
