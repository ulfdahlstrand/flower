// Side-effect imports — register all tools into the registry
import '../tools/github.js'
import '../tools/files.js'
import '../tools/git.js'
import '../tools/shell.js'

import type { AgentConfig, AgentRole } from '../types/index.js'
import { buildPmContext } from './context/pm.js'
import { buildRequirementsContext } from './context/requirements.js'
import { buildArchitectContext } from './context/architect.js'
import { buildDeveloperContext } from './context/developer.js'
import { buildTesterContext } from './context/tester.js'
import { buildReviewerContext } from './context/reviewer.js'
import { buildPoContext } from './context/po.js'

// ---------------------------------------------------------------------------
// Agent registry
//
// Each agent is pure data: model, tools, and a context builder.
// No agent-specific code lives in the runner.
// ---------------------------------------------------------------------------

const SONNET = 'claude-sonnet-4-6'

// Tool sets grouped by what each role actually needs
const ISSUE_READ = ['github_get_issue', 'github_list_issues', 'github_list_child_issues']
const ISSUE_WRITE = ['github_create_issue', 'github_close_issue', 'github_post_comment', 'github_add_label', 'github_remove_label']
const PR_READ = ['github_get_pr', 'github_get_pr_diff']
const PR_WRITE = ['github_create_pr']
const FILES = ['read_file', 'write_file', 'list_files']
const GIT = ['git_create_branch', 'git_checkout_branch', 'git_commit_and_push', 'git_current_branch']
const MILESTONE = ['github_create_milestone', 'github_close_milestone']
const LABELS_ADMIN = ['github_list_labels', 'github_create_label']

export const agentConfigs: Record<AgentRole, AgentConfig> = {
  po: {
    role: 'po',
    model: SONNET,
    tools: [...ISSUE_READ, ...ISSUE_WRITE],
    buildContext: buildPoContext,
  },

  pm: {
    role: 'pm',
    model: SONNET,
    tools: [...ISSUE_READ, ...ISSUE_WRITE, ...MILESTONE, ...LABELS_ADMIN, 'read_file'],
    buildContext: buildPmContext,
  },

  requirements: {
    role: 'requirements',
    model: SONNET,
    tools: [...ISSUE_READ, ...ISSUE_WRITE, ...FILES],
    buildContext: buildRequirementsContext,
  },

  architect: {
    role: 'architect',
    model: SONNET,
    tools: [...ISSUE_READ, ...ISSUE_WRITE, ...PR_READ, ...FILES, ...GIT],
    buildContext: buildArchitectContext,
  },

  developer: {
    role: 'developer',
    model: SONNET,
    tools: [...ISSUE_READ, ...ISSUE_WRITE, ...PR_WRITE, ...FILES, ...GIT, 'run_tests', 'run_command'],
    buildContext: buildDeveloperContext,
  },

  tester: {
    role: 'tester',
    model: SONNET,
    tools: [...ISSUE_READ, ...ISSUE_WRITE, ...PR_READ, ...FILES, ...GIT, 'run_tests'],
    buildContext: buildTesterContext,
  },

  reviewer: {
    role: 'reviewer',
    model: SONNET,
    tools: [...ISSUE_READ, ...ISSUE_WRITE, ...PR_READ, ...FILES],
    buildContext: buildReviewerContext,
  },
}

export const getAgentConfig = (role: AgentRole): AgentConfig => agentConfigs[role]
