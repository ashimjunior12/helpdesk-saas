import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer | undefined;

export async function connectTestDatabase(): Promise<void> {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  // Build unique indexes (e.g. email) before tests rely on them.
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}

export async function clearTestDatabase(): Promise<void> {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})));
}

export async function disconnectTestDatabase(): Promise<void> {
  await mongoose.disconnect();
  await mongod?.stop();
}
