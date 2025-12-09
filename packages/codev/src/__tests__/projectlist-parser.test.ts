/**
 * Tests for projectlist.md parser (Spec 0045)
 */

import { describe, it, expect } from 'vitest';
import {
  parseProjectEntry,
  parseProjectlist,
  isValidProject,
  escapeHtml,
  getStageIndex,
  getActiveProjects,
  getTerminalProjects,
  groupByStatus,
  LIFECYCLE_STAGES,
  Project,
} from '../lib/projectlist-parser.js';

describe('projectlist-parser', () => {
  describe('parseProjectEntry', () => {
    it('should parse a simple project entry', () => {
      const text = `
  - id: "0001"
    title: "Test Project"
    status: implementing
    priority: high
`;
      const project = parseProjectEntry(text);

      expect(project.id).toBe('0001');
      expect(project.title).toBe('Test Project');
      expect(project.status).toBe('implementing');
      expect(project.priority).toBe('high');
    });

    it('should parse files nested object', () => {
      const text = `
  - id: "0001"
    title: "Test"
    status: specified
    files:
      spec: codev/specs/0001-test.md
      plan: codev/plans/0001-test.md
      review: null
`;
      const project = parseProjectEntry(text);

      expect(project.files).toBeDefined();
      expect(project.files!.spec).toBe('codev/specs/0001-test.md');
      expect(project.files!.plan).toBe('codev/plans/0001-test.md');
      expect(project.files!.review).toBeNull();
    });

    it('should parse arrays', () => {
      const text = `
  - id: "0001"
    title: "Test"
    status: implementing
    dependencies: ["0002", "0003"]
    tags: [ui, dashboard]
    ticks: [001]
`;
      const project = parseProjectEntry(text);

      expect(project.dependencies).toEqual(['0002', '0003']);
      expect(project.tags).toEqual(['ui', 'dashboard']);
      expect(project.ticks).toEqual(['001']);
    });

    it('should handle empty arrays', () => {
      const text = `
  - id: "0001"
    title: "Test"
    status: implementing
    dependencies: []
    tags: []
`;
      const project = parseProjectEntry(text);

      expect(project.dependencies).toEqual([]);
      expect(project.tags).toEqual([]);
    });

    it('should handle quoted strings', () => {
      const text = `
  - id: "0001"
    title: "Project with 'quotes' and commas, etc."
    summary: 'Single quoted summary'
`;
      const project = parseProjectEntry(text);

      expect(project.id).toBe('0001');
      expect(project.title).toBe("Project with 'quotes' and commas, etc.");
      expect(project.summary).toBe('Single quoted summary');
    });

    it('should skip null values', () => {
      const text = `
  - id: "0001"
    title: "Test"
    status: conceived
    release: null
`;
      const project = parseProjectEntry(text);

      expect(project.release).toBeUndefined();
    });
  });

  describe('isValidProject', () => {
    it('should accept valid project', () => {
      const project: Partial<Project> = {
        id: '0001',
        title: 'Valid Project',
        status: 'implementing',
      };
      expect(isValidProject(project)).toBe(true);
    });

    it('should reject missing id', () => {
      expect(isValidProject({ title: 'Test', status: 'implementing' })).toBe(
        false
      );
    });

    it('should reject template id NNNN', () => {
      expect(
        isValidProject({ id: 'NNNN', title: 'Test', status: 'implementing' })
      ).toBe(false);
    });

    it('should reject non-4-digit id', () => {
      expect(
        isValidProject({ id: '123', title: 'Test', status: 'implementing' })
      ).toBe(false);
      expect(
        isValidProject({ id: '12345', title: 'Test', status: 'implementing' })
      ).toBe(false);
      expect(
        isValidProject({ id: 'abcd', title: 'Test', status: 'implementing' })
      ).toBe(false);
    });

    it('should reject missing title', () => {
      expect(isValidProject({ id: '0001', status: 'implementing' })).toBe(
        false
      );
    });

    it('should reject invalid status', () => {
      expect(
        isValidProject({ id: '0001', title: 'Test', status: 'invalid' })
      ).toBe(false);
    });

    it('should reject example projects', () => {
      expect(
        isValidProject({
          id: '0001',
          title: 'Test',
          status: 'implementing',
          tags: ['example'],
        })
      ).toBe(false);
    });

    it('should accept all valid statuses', () => {
      const validStatuses = [
        'conceived',
        'specified',
        'planned',
        'implementing',
        'implemented',
        'committed',
        'integrated',
        'abandoned',
        'on-hold',
      ];

      for (const status of validStatuses) {
        expect(
          isValidProject({ id: '0001', title: 'Test', status })
        ).toBe(true);
      }
    });
  });

  describe('parseProjectlist', () => {
    it('should parse multiple projects from YAML blocks', () => {
      const content = `
# Project List

## Active Projects

\`\`\`yaml
  - id: "0001"
    title: "First Project"
    status: implementing
    priority: high

  - id: "0002"
    title: "Second Project"
    status: specified
    priority: medium
\`\`\`
`;
      const projects = parseProjectlist(content);

      expect(projects).toHaveLength(2);
      expect(projects[0].id).toBe('0001');
      expect(projects[0].title).toBe('First Project');
      expect(projects[1].id).toBe('0002');
      expect(projects[1].title).toBe('Second Project');
    });

    it('should handle multiple YAML blocks', () => {
      const content = `
## Active

\`\`\`yaml
  - id: "0001"
    title: "Active Project"
    status: implementing
\`\`\`

## Released

\`\`\`yaml
  - id: "0002"
    title: "Released Project"
    status: integrated
\`\`\`
`;
      const projects = parseProjectlist(content);

      expect(projects).toHaveLength(2);
      expect(projects[0].status).toBe('implementing');
      expect(projects[1].status).toBe('integrated');
    });

    it('should filter out invalid projects', () => {
      const content = `
\`\`\`yaml
# This is the example format
  - id: "NNNN"
    title: "Brief title"
    status: conceived

# Real project
  - id: "0001"
    title: "Real Project"
    status: implementing
\`\`\`
`;
      const projects = parseProjectlist(content);

      expect(projects).toHaveLength(1);
      expect(projects[0].id).toBe('0001');
    });

    it('should return empty array on parse error', () => {
      // This would cause an issue if not handled
      const content = 'Not valid YAML at all';
      const projects = parseProjectlist(content);

      expect(projects).toEqual([]);
    });

    it('should handle empty content', () => {
      expect(parseProjectlist('')).toEqual([]);
    });

    it('should parse real-world projectlist format', () => {
      const content = `
## Active Projects

\`\`\`yaml
# High Priority
  - id: "0039"
    title: "Codev CLI (First-Class Command)"
    summary: "Unified codev command as primary entry point"
    status: implementing
    priority: high
    release: null
    files:
      spec: codev/specs/0039-codev-cli.md
      plan: codev/plans/0039-codev-cli.md
      review: null
    dependencies: ["0005", "0022"]
    tags: [cli, npm, architecture]
    notes: "TICK amendment 2025-12-09"
\`\`\`
`;
      const projects = parseProjectlist(content);

      expect(projects).toHaveLength(1);
      const project = projects[0];
      expect(project.id).toBe('0039');
      expect(project.title).toBe('Codev CLI (First-Class Command)');
      expect(project.summary).toBe(
        'Unified codev command as primary entry point'
      );
      expect(project.status).toBe('implementing');
      expect(project.priority).toBe('high');
      expect(project.files?.spec).toBe('codev/specs/0039-codev-cli.md');
      expect(project.dependencies).toEqual(['0005', '0022']);
      expect(project.tags).toEqual(['cli', 'npm', 'architecture']);
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
    });

    it('should handle null and undefined', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });

    it('should escape ampersands', () => {
      expect(escapeHtml('foo & bar')).toBe('foo &amp; bar');
    });

    it('should escape single quotes', () => {
      expect(escapeHtml("it's")).toBe('it&#39;s');
    });
  });

  describe('getStageIndex', () => {
    it('should return correct indices for lifecycle stages', () => {
      expect(getStageIndex('conceived')).toBe(0);
      expect(getStageIndex('specified')).toBe(1);
      expect(getStageIndex('planned')).toBe(2);
      expect(getStageIndex('implementing')).toBe(3);
      expect(getStageIndex('implemented')).toBe(4);
      expect(getStageIndex('committed')).toBe(5);
      expect(getStageIndex('integrated')).toBe(6);
    });

    it('should return -1 for invalid status', () => {
      expect(getStageIndex('invalid')).toBe(-1);
      expect(getStageIndex('abandoned')).toBe(-1);
      expect(getStageIndex('on-hold')).toBe(-1);
    });
  });

  describe('getActiveProjects', () => {
    const projects: Project[] = [
      { id: '0001', title: 'Active', status: 'implementing' },
      { id: '0002', title: 'Abandoned', status: 'abandoned' },
      { id: '0003', title: 'On Hold', status: 'on-hold' },
      { id: '0004', title: 'Completed', status: 'integrated' },
    ];

    it('should filter out terminal projects', () => {
      const active = getActiveProjects(projects);

      expect(active).toHaveLength(2);
      expect(active.map((p) => p.id)).toEqual(['0001', '0004']);
    });
  });

  describe('getTerminalProjects', () => {
    const projects: Project[] = [
      { id: '0001', title: 'Active', status: 'implementing' },
      { id: '0002', title: 'Abandoned', status: 'abandoned' },
      { id: '0003', title: 'On Hold', status: 'on-hold' },
    ];

    it('should return only terminal projects', () => {
      const terminal = getTerminalProjects(projects);

      expect(terminal).toHaveLength(2);
      expect(terminal.map((p) => p.id)).toEqual(['0002', '0003']);
    });
  });

  describe('groupByStatus', () => {
    const projects: Project[] = [
      { id: '0001', title: 'P1', status: 'implementing' },
      { id: '0002', title: 'P2', status: 'implementing' },
      { id: '0003', title: 'P3', status: 'specified' },
    ];

    it('should group projects by status', () => {
      const groups = groupByStatus(projects, ['implementing', 'specified']);

      expect(groups.implementing).toHaveLength(2);
      expect(groups.specified).toHaveLength(1);
    });

    it('should return empty arrays for missing statuses', () => {
      const groups = groupByStatus(projects, ['conceived']);

      expect(groups.conceived).toHaveLength(0);
    });
  });

  describe('LIFECYCLE_STAGES constant', () => {
    it('should have 7 stages in correct order', () => {
      expect(LIFECYCLE_STAGES).toEqual([
        'conceived',
        'specified',
        'planned',
        'implementing',
        'implemented',
        'committed',
        'integrated',
      ]);
    });
  });
});
