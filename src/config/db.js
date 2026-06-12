import mongoose from "mongoose";

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is missing. Add it to your .env file.");
    process.exit(1);
  }

  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB Connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);

    if (error.message.includes("bad auth")) {
      console.error(
        "\nFix: In MongoDB Atlas → Database Access, reset the password for user 'rehmanfahad', then update MONGO_URI in .env.\n" +
          "URL-encode special characters in the password (@ → %40, < → %3C, > → %3E).\n" +
          "Example: MONGO_URI=mongodb+srv://USERNAME:ENCODED_PASSWORD@vaas.f2m4bo8.mongodb.net/vaas?appName=vaas"
      );
    } else if (error.message.includes("ENOTFOUND")) {
      console.error(
        "\nFix: Your MONGO_URI hostname looks wrong — usually caused by an unencoded @ in the password.\n" +
          "Encode @ as %40 in the password section of the URI."
      );
    }

    process.exit(1);
  }
};

export default connectDB;
