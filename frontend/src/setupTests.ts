// jest-dom adds custom matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom/vitest';

import { vi } from 'vitest';

// Konva needs the native canvas package outside the browser
vi.mock('react-konva', () => import('./testUtils/reactKonvaMock'));
