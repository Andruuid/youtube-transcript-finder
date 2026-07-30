import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPoliticsOrder,
  normalizePoliticsSide,
  PoliticsError
} from './politicsService.js';

function membership(id, side, position) {
  return {
    id,
    side,
    position,
    channel: {
      youtubeChannelId: `channel-${id}`,
      title: `Channel ${id}`
    }
  };
}

test('normalizes valid sides and rejects invalid classifications', () => {
  assert.equal(normalizePoliticsSide(' LEFT '), 'left');
  assert.equal(normalizePoliticsSide('all', { allowAll: true }), 'all');
  assert.throws(
    () => normalizePoliticsSide('centre'),
    (error) => error instanceof PoliticsError && error.statusCode === 400
  );
});

test('moves and normalizes a membership within its side', () => {
  const result = buildPoliticsOrder(
    [
      membership(1, 'left', 0),
      membership(2, 'left', 1),
      membership(3, 'left', 2)
    ],
    'channel-3',
    'left',
    0
  );

  assert.deepEqual(
    result.filter((item) => item.side === 'left'),
    [
      { id: 3, side: 'left', position: 0 },
      { id: 1, side: 'left', position: 1 },
      { id: 2, side: 'left', position: 2 }
    ]
  );
});

test('rejects moving into a full destination side', () => {
  const items = [
    membership(50, 'left', 0),
    ...Array.from({ length: 10 }, (_, index) =>
      membership(index + 1, 'right', index)
    )
  ];

  assert.throws(
    () => buildPoliticsOrder(items, 'channel-50', 'right', 10),
    (error) => error instanceof PoliticsError && error.statusCode === 409
  );
});

test('rejects a non-integer position', () => {
  assert.throws(
    () =>
      buildPoliticsOrder(
        [membership(1, 'left', 0)],
        'channel-1',
        'left',
        'not-a-position'
      ),
    (error) => error instanceof PoliticsError && error.statusCode === 400
  );
});
