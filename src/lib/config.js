const fs = require('node:fs/promises');
const { pathInProject } = require('./paths');

const DEFAULT_CONFIG = {
  llm: {
    model: 'gpt-4.1-mini',
  },
  propose: {
    max_must_additions: 3,
  },
  patch: {
    mode: 'diff',
  },
  targets: {
    enabled: ['chat', 'claude-code', 'codex', 'copilot', 'gemini', 'opencode', 'cursor', 'openclaw'],
  },
  install: {
    mode: 'symlink',
    on_conflict: 'backup',
    destinations: {
      chat: '~/.config/ai-rules/targets/chat/custom_instructions.txt',
      'claude-code': '~/.claude/CLAUDE.md',
      codex: '~/.codex/AGENTS.md',
      copilot: '~/.copilot/copilot-instructions.md',
      gemini: '~/.gemini/GEMINI.md',
      opencode: '~/.config/opencode/AGENTS.md',
      openclaw: '~/.config/ai-rules/targets/openclaw/skills/personal-constitution/SKILL.md',
    },
  },
};

function migrateTargetName(name) {
  if (name === 'coding-agent') {
    return 'claude-code';
  }
  return name;
}

function parseConfig(raw) {
  const lines = raw.replace(/\r/g, '\n').split('\n');
  let section = '';
  let subSection = '';
  let inTargetsEnabled = false;

  let llmModel = DEFAULT_CONFIG.llm.model;
  let maxMust = DEFAULT_CONFIG.propose.max_must_additions;
  let patchMode = DEFAULT_CONFIG.patch.mode;
  let installMode = DEFAULT_CONFIG.install.mode;
  let onConflict = DEFAULT_CONFIG.install.on_conflict;
  const enabled = [];
  const destinations = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const isTopLevel = /^[A-Za-z0-9_-]+:\s*$/.test(line);
    if (isTopLevel) {
      section = trimmed.slice(0, -1);
      subSection = '';
      inTargetsEnabled = false;
      continue;
    }

    if (section === 'llm') {
      const m = trimmed.match(/^model:\s*(.+)\s*$/);
      if (m) {
        let val = m[1];
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        llmModel = val;
      }
    }

    if (section === 'propose') {
      const m = trimmed.match(/^max_must_additions:\s*(\d+)\s*$/);
      if (m) {
        maxMust = Number(m[1]);
      }
    }

    if (section === 'patch') {
      const m = trimmed.match(/^mode:\s*(diff|branch)\s*$/);
      if (m) {
        patchMode = m[1];
      }
    }
    if (section === 'install') {
      if (trimmed === 'destinations:') {
        subSection = 'destinations';
        continue;
      }
      if (subSection === 'destinations') {
        const kv = trimmed.match(/^([A-Za-z0-9_-]+):\s*(.+)\s*$/);
        if (kv) {
          let value = kv[2];
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          destinations[migrateTargetName(kv[1])] = value;
          continue;
        }
        subSection = '';
      }
      const mode = trimmed.match(/^mode:\s*(symlink|copy)\s*$/);
      if (mode) {
        installMode = mode[1];
      }
      const conflict = trimmed.match(/^on_conflict:\s*(error|backup|overwrite|skip)\s*$/);
      if (conflict) {
        onConflict = conflict[1];
      }
    }

    if (section === 'targets' && trimmed === 'enabled:') {
      inTargetsEnabled = true;
      continue;
    }
    if (section === 'targets' && inTargetsEnabled) {
      const item = trimmed.match(/^-\s*([A-Za-z0-9_-]+)\s*$/);
      if (item) {
        enabled.push(migrateTargetName(item[1]));
        continue;
      }
      inTargetsEnabled = false;
    }

    if (section === 'install_destinations') {
      const kv = trimmed.match(/^([A-Za-z0-9_-]+):\s*(.+)\s*$/);
      if (kv) {
        let value = kv[2];
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        destinations[migrateTargetName(kv[1])] = value;
      }
    }
  }

  return {
    llm: {
      model: llmModel || DEFAULT_CONFIG.llm.model,
    },
    propose: {
      max_must_additions: Number.isFinite(maxMust) ? maxMust : DEFAULT_CONFIG.propose.max_must_additions,
    },
    patch: {
      mode: patchMode === 'branch' ? 'branch' : 'diff',
    },
    targets: {
      enabled: enabled.length > 0 ? enabled : DEFAULT_CONFIG.targets.enabled,
    },
    install: {
      mode: installMode === 'copy' ? 'copy' : 'symlink',
      on_conflict: ['backup', 'overwrite', 'skip'].includes(onConflict) ? onConflict : 'backup',
      destinations: {
        ...DEFAULT_CONFIG.install.destinations,
        ...destinations,
      },
    },
  };
}

async function loadConfig() {
  const configPath = pathInProject('config', 'config.yaml');
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    return parseConfig(raw);
  } catch {
    return DEFAULT_CONFIG;
  }
}

async function loadProjectConfig(projectRoot) {
  const configPath = require('node:path').join(projectRoot, '.ai-rules', 'config.yaml');
  try {
    const raw = await fs.readFile(configPath, 'utf8');
    return parseProjectConfig(raw);
  } catch {
    return null;
  }
}

function parseProjectConfig(raw) {
  const lines = raw.replace(/\r/g, '\n').split('\n');
  let section = '';
  let subSection = '';
  let inTargetsEnabled = false;

  let source = 'project.md';
  let installMode = 'copy';
  let onConflict = 'backup';
  const enabled = [];
  const destinations = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const isTopLevel = /^[A-Za-z0-9_-]+:\s*$/.test(line);
    if (isTopLevel) {
      section = trimmed.slice(0, -1);
      subSection = '';
      inTargetsEnabled = false;
      continue;
    }

    if (!section) {
      const srcMatch = trimmed.match(/^source:\s*(.+)\s*$/);
      if (srcMatch) {
        let val = srcMatch[1];
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        source = val;
      }
    }

    if (section === 'targets' && trimmed === 'enabled:') {
      inTargetsEnabled = true;
      continue;
    }
    if (section === 'targets' && inTargetsEnabled) {
      const item = trimmed.match(/^-\s*([A-Za-z0-9_-]+)\s*$/);
      if (item) {
        enabled.push(item[1]);
        continue;
      }
      inTargetsEnabled = false;
    }

    if (section === 'install') {
      if (trimmed === 'destinations:') {
        subSection = 'destinations';
        continue;
      }
      if (subSection === 'destinations') {
        const kv = trimmed.match(/^([A-Za-z0-9_-]+):\s*(.+)\s*$/);
        if (kv) {
          let value = kv[2];
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          destinations[kv[1]] = value;
          continue;
        }
        subSection = '';
      }
      const mode = trimmed.match(/^mode:\s*(symlink|copy)\s*$/);
      if (mode) {
        installMode = mode[1];
      }
      const conflict = trimmed.match(/^on_conflict:\s*(error|backup|overwrite|skip)\s*$/);
      if (conflict) {
        onConflict = conflict[1];
      }
    }
  }

  return {
    source,
    targets: {
      enabled: enabled.length > 0 ? enabled : ['claude-code'],
    },
    install: {
      mode: installMode,
      on_conflict: onConflict,
      destinations,
    },
  };
}

module.exports = {
  loadConfig,
  loadProjectConfig,
  parseConfig,
  parseProjectConfig,
};
