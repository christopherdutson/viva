export interface ConceptDefinition {
  id: number;
  name: string;
  description: string;
}

export interface QuestionRubric {
  questionNumber: number;
  questionText: string;
  concepts: ConceptDefinition[];
}

export const RUBRICS: QuestionRubric[] = [
  {
    questionNumber: 1,
    questionText:
      'Explain how distributed systems use quorum-based decisions to handle node failures, and describe the role of fencing tokens in preventing split-brain scenarios.',
    concepts: [
      {
        id: 1,
        name: 'Quorum definition',
        description: 'A quorum requires agreement from a majority of nodes (more than half)',
      },
      {
        id: 2,
        name: 'Overlap guarantee',
        description: 'Any two quorums must share at least one node, ensuring consistency',
      },
      {
        id: 3,
        name: 'Leader election',
        description: 'Quorum voting can determine which node acts as leader/primary',
      },
      {
        id: 4,
        name: 'Split-brain problem',
        description: 'Multiple nodes may incorrectly believe they are the leader simultaneously',
      },
      {
        id: 5,
        name: 'Fencing token definition',
        description: 'A monotonically increasing number issued with each lock/lease grant',
      },
      {
        id: 6,
        name: 'Token validation',
        description: 'Resources reject operations carrying an older fencing token',
      },
      {
        id: 7,
        name: 'Lock vs. lease',
        description: 'Leases are time-bounded locks that expire automatically',
      },
      {
        id: 8,
        name: 'Failure tolerance',
        description: 'A system with n nodes can tolerate up to (n-1)/2 failures with quorum',
      },
    ],
  },
  {
    questionNumber: 2,
    questionText:
      'Compare Byzantine faults with crash faults in distributed systems. Under what conditions might a system need Byzantine fault tolerance, and why do most practical systems only handle crash faults?',
    concepts: [
      {
        id: 1,
        name: 'Crash fault definition',
        description: "A node fails by stopping — it either works correctly or doesn't respond at all",
      },
      {
        id: 2,
        name: 'Byzantine fault definition',
        description:
          'A node may behave arbitrarily: sending conflicting messages, lying, or acting maliciously',
      },
      {
        id: 3,
        name: 'Byzantine use cases',
        description:
          'Required in adversarial environments (blockchain, aerospace, multi-party computation)',
      },
      {
        id: 4,
        name: 'Crash fault assumption',
        description: 'Most datacenter systems assume nodes are honest but may crash',
      },
      {
        id: 5,
        name: 'Cost of BFT',
        description:
          'Byzantine fault tolerance requires significantly more communication rounds and nodes (typically 3f+1 to tolerate f faults)',
      },
      {
        id: 6,
        name: 'Trust boundary',
        description: "Byzantine tolerance is needed when participants don't fully trust each other",
      },
      {
        id: 7,
        name: 'Practical simplification',
        description:
          'Crash-fault models are simpler to reason about and more efficient in trusted environments',
      },
      {
        id: 8,
        name: 'Real-world tradeoff',
        description:
          'Systems choose their fault model based on the threat model and operational environment',
      },
    ],
  },
  {
    questionNumber: 3,
    questionText:
      'Describe the main system models for timing assumptions in distributed systems. Then explain the difference between safety and liveness properties, and give an example of each in the context of a distributed database.',
    concepts: [
      {
        id: 1,
        name: 'Synchronous model',
        description:
          'All messages arrive within a known, bounded time; processes respond within a known time',
      },
      {
        id: 2,
        name: 'Asynchronous model',
        description:
          'No timing assumptions — messages can be delayed arbitrarily, no clocks available',
      },
      {
        id: 3,
        name: 'Partially synchronous model',
        description:
          'System behaves synchronously most of the time but occasionally exceeds bounds',
      },
      {
        id: 4,
        name: 'Practical relevance',
        description:
          'Partial synchrony is the most realistic model for real-world distributed systems',
      },
      {
        id: 5,
        name: 'Safety property definition',
        description:
          'Something bad never happens — if violated, the violation occurred at a specific point in time',
      },
      {
        id: 6,
        name: 'Liveness property definition',
        description: 'Something good eventually happens — the system makes progress',
      },
      {
        id: 7,
        name: 'Safety example',
        description:
          'Example: uniqueness (no two nodes hold the same lock), consistency (no conflicting reads)',
      },
      {
        id: 8,
        name: 'Liveness example',
        description:
          'Example: availability (every request eventually gets a response), termination (algorithm eventually decides)',
      },
      {
        id: 9,
        name: 'Safety–liveness tension',
        description:
          'Distributed algorithms must satisfy both, but they can conflict under network partitions',
      },
      {
        id: 10,
        name: 'Crash-recovery model',
        description:
          'Nodes may crash and restart, losing in-memory state but retaining durable storage',
      },
      {
        id: 11,
        name: 'Fail-stop vs. fail-recovery',
        description: 'Fail-stop nodes never come back; fail-recovery nodes may rejoin after crashing',
      },
      {
        id: 12,
        name: 'Model as abstraction',
        description:
          'System models let algorithm designers prove correctness properties under stated assumptions',
      },
    ],
  },
];

export function getRubric(questionNumber: number): QuestionRubric | undefined {
  return RUBRICS.find((r) => r.questionNumber === questionNumber);
}
