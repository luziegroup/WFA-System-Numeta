/* ============================================================
 * FILE   : 00-firebase-config.js
 * BAGIAN : Konfigurasi Firebase
 * ISI    : Inisialisasi koneksi ke Firebase Realtime Database (kredensial project).
 * ============================================================ */

  const firebaseConfig = {
    apiKey: "AIzaSyCp1LgPxQr5FmPW0sLKAs0My2OuT20-GGY",
    authDomain: "wfa-system-numeta.firebaseapp.com",
    databaseURL: "https://wfa-system-numeta-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "wfa-system-numeta",
    storageBucket: "wfa-system-numeta.firebasestorage.app",
    messagingSenderId: "136549410920",
    appId: "1:136549410920:web:542e7782cff26bbbcef3dd",
    measurementId: "G-FVMTYMPQSQ"
  };
  firebase.initializeApp(firebaseConfig);
  const rtdb = firebase.database();
