// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// react-markdown is ESM-only while react-scripts 5 runs Jest in CJS mode.
// The app tests only need the rendered text contract.
jest.mock('react-markdown', () => function MarkdownMock({ children }) {
  return children;
});
