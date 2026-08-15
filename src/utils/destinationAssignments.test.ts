import { describe, expect, it } from 'vitest';
import { summarizeDestinationAssignments } from './destinationAssignments';

describe('summarizeDestinationAssignments', () => {
  it('reports a group with no assignments', () => {
    expect(summarizeDestinationAssignments([0, 1], {})).toEqual({
      assignedCount: 0,
      destinationCount: 0,
    });
  });

  it('counts explicit My Drive Root as an assignment', () => {
    expect(
      summarizeDestinationAssignments([0, 1], {
        0: { destination: { id: null } },
      }),
    ).toEqual({ assignedCount: 1, destinationCount: 1 });
  });

  it('counts distinct assigned destinations', () => {
    expect(
      summarizeDestinationAssignments([0, 1, 2], {
        0: { destination: { id: 'series-a' } },
        1: { destination: { id: 'series-a' } },
        2: { destination: { id: 'series-b' } },
      }),
    ).toEqual({ assignedCount: 3, destinationCount: 2 });
  });
});
