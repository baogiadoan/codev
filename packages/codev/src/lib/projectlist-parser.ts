/**
 * Projectlist.md parser for the Projects Tab UI (Spec 0045)
 *
 * This module provides functions to parse the YAML project entries from
 * codev/projectlist.md. It's used by both the dashboard UI and for testing.
 */

export interface ProjectFiles {
  spec?: string | null;
  plan?: string | null;
  review?: string | null;
}

export interface Project {
  id: string;
  title: string;
  summary?: string;
  status: string;
  priority?: string;
  release?: string;
  files?: ProjectFiles;
  dependencies?: string[];
  tags?: string[];
  ticks?: string[];
  notes?: string;
}

export const VALID_STATUSES = [
  'conceived',
  'specified',
  'planned',
  'implementing',
  'implemented',
  'committed',
  'integrated',
  'abandoned',
  'on-hold',
] as const;

export type ProjectStatus = (typeof VALID_STATUSES)[number];

export const LIFECYCLE_STAGES: ProjectStatus[] = [
  'conceived',
  'specified',
  'planned',
  'implementing',
  'implemented',
  'committed',
  'integrated',
];

/**
 * XSS-safe HTML escaping
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Parse a single project entry from YAML-like text
 */
export function parseProjectEntry(text: string): Partial<Project> {
  const project: Partial<Project> = {};
  const lines = text.split('\n');

  for (const line of lines) {
    // Match key: value or key: "value"
    // Also handle "- id:" YAML list format
    const match = line.match(/^\s*-?\s*(\w+):\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    // Remove quotes if present
    let value = rawValue.trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    // Handle nested files object
    if (key === 'files') {
      project.files = {};
      continue;
    }
    if (key === 'spec' || key === 'plan' || key === 'review') {
      if (!project.files) project.files = {};
      (project.files as Record<string, string | null>)[key] =
        value === 'null' ? null : value;
      continue;
    }

    // Handle arrays (simple inline format)
    if (key === 'dependencies' || key === 'tags' || key === 'ticks') {
      if (value.startsWith('[') && value.endsWith(']')) {
        const inner = value.slice(1, -1);
        if (inner.trim() === '') {
          (project as Record<string, string[]>)[key] = [];
        } else {
          (project as Record<string, string[]>)[key] = inner
            .split(',')
            .map((s) => s.trim().replace(/^["']|["']$/g, ''));
        }
      } else {
        (project as Record<string, string[]>)[key] = [];
      }
      continue;
    }

    // Regular string values
    if (value !== 'null') {
      (project as Record<string, string>)[key] = value;
    }
  }

  return project;
}

/**
 * Validate that a project entry is valid
 */
export function isValidProject(project: Partial<Project>): project is Project {
  // Must have id (4-digit string, not "NNNN")
  if (
    !project.id ||
    project.id === 'NNNN' ||
    !/^\d{4}$/.test(project.id)
  ) {
    return false;
  }

  // Must have status
  if (
    !project.status ||
    !VALID_STATUSES.includes(project.status as ProjectStatus)
  ) {
    return false;
  }

  // Must have title
  if (!project.title) {
    return false;
  }

  // Filter out example entries
  if (project.tags && project.tags.includes('example')) {
    return false;
  }

  return true;
}

/**
 * Parse projectlist.md content into array of projects
 */
export function parseProjectlist(content: string): Project[] {
  const projects: Project[] = [];

  try {
    // Extract YAML code blocks
    const yamlBlockRegex = /```yaml\n([\s\S]*?)```/g;
    let match;

    while ((match = yamlBlockRegex.exec(content)) !== null) {
      const block = match[1];

      // Split by project entries (lines starting with "  - id:")
      // Handle both top-level and indented entries
      const projectMatches = block.split(/\n(?=\s*- id:)/);

      for (const projectText of projectMatches) {
        if (!projectText.trim() || !projectText.includes('id:')) continue;

        const project = parseProjectEntry(projectText);
        if (isValidProject(project)) {
          projects.push(project);
        }
      }
    }
  } catch {
    // Return empty array on parse error
    return [];
  }

  return projects;
}

/**
 * Get the index of a lifecycle stage
 */
export function getStageIndex(status: string): number {
  return LIFECYCLE_STAGES.indexOf(status as ProjectStatus);
}

/**
 * Filter projects to only active (non-terminal) ones
 */
export function getActiveProjects(projects: Project[]): Project[] {
  return projects.filter(
    (p) => !['abandoned', 'on-hold'].includes(p.status)
  );
}

/**
 * Filter projects to only terminal (abandoned, on-hold) ones
 */
export function getTerminalProjects(projects: Project[]): Project[] {
  return projects.filter((p) =>
    ['abandoned', 'on-hold'].includes(p.status)
  );
}

/**
 * Get projects grouped by status
 */
export function groupByStatus(
  projects: Project[],
  statuses: string[]
): Record<string, Project[]> {
  const groups: Record<string, Project[]> = {};
  for (const status of statuses) {
    groups[status] = projects.filter((p) => p.status === status);
  }
  return groups;
}
