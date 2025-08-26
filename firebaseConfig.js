// Initialize Firebase
// Replace the placeholders with your Firebase project configuration
if (typeof firebase !== 'undefined') {
  const firebaseConfig = {
  apiKey: "AIzaSyAT_cP4Q6Zq4RLGv17YZmpJLz7DsebKfoE",
  authDomain: "organiaescritorio.firebaseapp.com",
  projectId: "organiaescritorio",
  storageBucket: "organiaescritorio.firebasestorage.app",
  messagingSenderId: "388567715549",
  appId: "1:388567715549:web:a75cb42c7f71b1ede75534"
  };
  firebase.initializeApp(firebaseConfig);
  // Expose Firestore globally for easy access in app.js
  window.db = firebase.firestore();
}
