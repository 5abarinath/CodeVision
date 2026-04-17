import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { config } from 'dotenv';

config({ path: '.env.local' });

process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://example.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key';

import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

if (!('scrollIntoView' in HTMLElement.prototype)) {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
    value: () => {},
    writable: true,
  });
}
