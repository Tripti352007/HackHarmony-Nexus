// ================= FIREBASE SETUP =================

// Import Firebase (MODULAR SDK - latest stable)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


// ================= YOUR FIREBASE CONFIG =================

const firebaseConfig = {
  apiKey: "AIzaSyAkZcKLzOybDK3RC66M9Cb_9S8HNa6X91Y",
  authDomain: "sahayta-dedee.firebaseapp.com",
  projectId: "sahayta-dedee",
  storageBucket: "sahayta-dedee.firebasestorage.app",
  messagingSenderId: "658715036241",
  appId: "1:658715036241:web:57c4194fc4953f18928670"
};


// ================= INITIALIZE =================

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);


// ================= COLLECTION REFERENCE =================

const requestsCollection = collection(db, "requests");


// ================= ADD REQUEST =================

export async function addRequest(data) {
  try {
    const docRef = await addDoc(requestsCollection, {
      name: data.name || "Anonymous",
      location: data.location || "Unknown",
      need: data.need || "General",
      urgency: data.urgency || "low",
      timestamp: serverTimestamp()
    });

    console.log("Request added with ID:", docRef.id);
    return { success: true, id: docRef.id };

  } catch (error) {
    console.error("Error adding request:", error);
    return { success: false, error };
  }
}


// ================= GET ALL REQUESTS =================

export async function getRequests() {
  try {
    const q = query(requestsCollection, orderBy("timestamp", "desc"));
    const snapshot = await getDocs(q);

    const requests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return requests;

  } catch (error) {
    console.error("Error fetching requests:", error);
    return [];
  }
}


// ================= REAL-TIME LISTENER =================
// (For live dashboard updates - BEST FEATURE)

export function subscribeToRequests(callback) {
  const q = query(requestsCollection, orderBy("timestamp", "desc"));

  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    callback(requests);
  });
}