import { Suspense } from 'react';
import WidgetForm from './WidgetForm';

// Embeddable support widget, opened as /widget?key=<publicWidgetKey>. Rendered on
// its own so it can be dropped into an iframe on any site.
export default function WidgetPage() {
  return (
    <Suspense fallback={null}>
      <WidgetForm />
    </Suspense>
  );
}
