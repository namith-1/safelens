// src/config/db.ts
import mongoose from 'mongoose';
import dotenv from 'dotenv';

const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : '.env.development';

dotenv.config({ path: envFile });

const uri = process.env.MONGO_URI as string;

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGO_URI as string;
  if (!uri) {
    console.warn('⚠️  MONGO_URI is not defined. Running in database-less fallback mode.');
    return;
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅  MongoDB connected: ${conn.connection.host}`);
  } catch (err) {
    console.warn('⚠️  MongoDB connection error (running in fallback offline mode):', err);
  }
};
