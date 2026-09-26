import { fireEvent, render, screen } from '@testing-library/react';
import AppNav, { APP_VIEWS, viewSubtitle } from './components/AppNav';

test('places Crypto immediately after Channel monitor', () => {
  const ids = APP_VIEWS.map(view => view.id);
  expect(ids.indexOf('crypto')).toBe(ids.indexOf('channels') + 1);
  expect(viewSubtitle('crypto')).toMatch(/crypto market outcomes/);
});

test('places Politics immediately before Search and exposes its subtitle', () => {
  const ids = APP_VIEWS.map((view) => view.id);
  expect(ids.indexOf('politics')).toBe(ids.indexOf('search') - 1);
  expect(viewSubtitle('politics')).toMatch(/political transcript corpus/i);
});

test('selects the Politics navigation tab', () => {
  const onChange = jest.fn();
  render(<AppNav activeId="channels" onChange={onChange} />);

  fireEvent.click(screen.getByRole('button', { name: 'Politics' }));

  expect(onChange).toHaveBeenCalledWith('politics');
});
