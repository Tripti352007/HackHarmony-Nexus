// ================= IMPORT FIREBASE FUNCTIONS =================
import { addRequest, getRequests, subscribeToRequests } from "./supabase.js";


// ================= BASIC TEST (RUN ON LOAD) =================

// This runs when page loads → just to confirm connection
async function testConnection() {
  console.log("Checking Firebase connection...");

  try {
    const data = await getRequests();
    console.log("Firebase Connected ✅");
    console.log("Existing Data:", data);
  } catch (error) {
    console.error("Firebase NOT connected ❌", error);
  }
}


// ================= TEST ADD FUNCTION =================

async function testAddData() {
  try {
    const result = await addRequest({
      name: "Test User",
      location: "Test City",
      need: "Food",
      urgency: "high"
    });

    if (result.success) {
      console.log("Test data added successfully ✅");
    } else {
      console.error("Failed to add data ❌");
    }

  } catch (error) {
    console.error("Error while adding test data:", error);
  }
}


// ================= REAL-TIME LISTENER (BEST FEATURE) =================

function startRealtimeListener() {
  subscribeToRequests((data) => {
    console.log("Real-time update 🔄:", data);
  });
}


// ================= RUN ALL TESTS =================

testConnection();
testAddData();
startRealtimeListener();