// Initialize Firebase
// Replace the placeholders with your Firebase project configuration
if (typeof firebase !== 'undefined') {
  const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_AUTH_DOMAIN",
    projectId: "YOUR_PROJECT_ID"
  };
  firebase.initializeApp(firebaseConfig);
  // Expose Firestore globally for easy access in app.js
  window.db = firebase.firestore();
}
