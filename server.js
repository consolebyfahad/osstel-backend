import "dotenv/config";
import app from "./src/app.js";
import connectDB from "./src/config/db.js";
import validateEnv from "./src/config/env.js";
import initFirebase from "./src/config/firebase.js";
import { startRentSyncJob } from "./src/jobs/rentSyncJob.js";

validateEnv();
initFirebase();

const PORT = process.env.PORT || 5001;

await connectDB();

startRentSyncJob();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
