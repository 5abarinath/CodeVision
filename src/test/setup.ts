import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { config } from 'dotenv';

config({ path: '.env.local' });
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
