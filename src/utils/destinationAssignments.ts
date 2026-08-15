export function summarizeDestinationAssignments(
  indices: number[],
  assignments: Readonly<Record<number, { destination: { id: string | null } }>>,
) {
  let assignedCount = 0;
  const destinationIds = new Set<string | null>();

  for (const index of indices) {
    const assignment = assignments[index];
    if (!assignment) continue;

    assignedCount += 1;
    destinationIds.add(assignment.destination.id);
  }

  return { assignedCount, destinationCount: destinationIds.size };
}
