import { redirect } from 'next/navigation';

// The product opens directly into the app; the app shell handles auth/org gating.
export default function RootPage() {
  redirect('/app');
}
