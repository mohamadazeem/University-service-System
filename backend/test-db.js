const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();

const testConnection = async () => {
    if (!process.env.MONGO_URI) {
        throw new Error("MONGO_URI is not set in the environment");
    }

    await mongoose.connect(process.env.MONGO_URI, {
        serverSelectionTimeoutMS: 10000
    });

    console.log("MongoDB connection test passed");
};

testConnection()
    .catch((error) => {
        console.error("MongoDB connection test failed:", error.message);
        process.exitCode = 1;
    })
    .finally(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.disconnect();
        }
    });