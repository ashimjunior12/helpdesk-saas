import { Schema, model } from 'mongoose';

interface Counter {
  _id: string;
  seq: number;
}

const counterSchema = new Schema<Counter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

const CounterModel = model<Counter>('Counter', counterSchema);

// Returns the next per-organization ticket number using an atomic $inc, so
// concurrent creates never receive the same number.
export async function nextTicketNumber(organizationId: string): Promise<number> {
  const counter = await CounterModel.findByIdAndUpdate(
    `ticket:${organizationId}`,
    { $inc: { seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return counter.seq;
}
