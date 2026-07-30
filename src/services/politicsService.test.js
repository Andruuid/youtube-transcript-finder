import { politicsCollectionOrder } from './politicsService';

const channel = (id, side, position) => ({
  youtubeChannelId: id,
  title: id,
  side,
  position
});

test('interleaves both sides for a balanced collection run', () => {
  const board = {
    left: [channel('L1', 'left', 0), channel('L2', 'left', 1)],
    right: [
      channel('R1', 'right', 0),
      channel('R2', 'right', 1),
      channel('R3', 'right', 2)
    ]
  };

  expect(
    politicsCollectionOrder(board, 'all').map((item) => item.youtubeChannelId)
  ).toEqual(['L1', 'R1', 'L2', 'R2', 'R3']);
  expect(
    politicsCollectionOrder(board, 'left').map((item) => item.youtubeChannelId)
  ).toEqual(['L1', 'L2']);
});
