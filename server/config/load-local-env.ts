import dotenv from "dotenv";

// Keep .env as the shared base and fill missing values from the ignored local file.
dotenv.config({ path: ".env.local" });
