# Plank Framework Cursor Rules

This directory contains comprehensive Cursor rules that serve as the "bible" for Plank framework development. These rules ensure all development follows the exact specifications from your documentation.

## Rule Overview

### 1. **plank-framework-bible.mdc** ⭐ (Always Active)
- **Purpose**: Core framework principles and non-negotiable constraints
- **Scope**: Always applied to every request
- **Key Content**:
  - References to requirements.md, plan.md, and tasks.md
  - Core principles (HTML-first, progressive enhancement, etc.)
  - Performance budgets (10KB marketing, 35KB app, 0KB static)
  - Package structure and development phases

### 2. **architecture-design.mdc** (TypeScript/JavaScript/Template files)
- **Purpose**: Architecture and design principles
- **Scope**: Applied to `*.ts`, `*.js`, `*.plk` files
- **Key Content**:
  - Layered architecture (Compiler, Runtime, Server, Router)
  - Reactivity model with signals
  - Template directives and patterns
  - Server actions implementation
  - Resumability requirements

### 3. **development-workflow.mdc** (Development files)
- **Purpose**: Development workflow and standards
- **Scope**: Applied to `*.ts`, `*.js`, `*.json`, `*.md` files
- **Key Content**:
  - Monorepo setup with PNPM + Turborepo
  - Package structure and naming conventions
  - TypeScript configuration
  - Testing requirements and CI setup
  - Security and accessibility checklists

### 4. **performance-budgets.mdc** (Code and config files)
- **Purpose**: Performance requirements and budget enforcement
- **Scope**: Applied to `*.ts`, `*.js`, `*.plk`, `*.json` files
- **Key Content**:
  - JavaScript budget enforcement
  - Performance monitoring and analysis
  - Optimization strategies
  - CI integration for budget checks
  - Anti-patterns to avoid

### 5. **implementation-roadmap.mdc** (Manual application)
- **Purpose**: Implementation roadmap and task tracking
- **Scope**: Manually applied when needed
- **Key Content**:
  - Complete task breakdown from tasks.md
  - Phase-by-phase implementation guide
  - Repository setup requirements
  - Success metrics and risk mitigation
  - Timeline and dependencies

## How to Use These Rules

### Automatic Application
- The main `plank-framework-bible.mdc` rule is always active
- Other rules apply automatically based on file types
- Rules reference your source documents using `mdc:` syntax

### Manual Application
- Use `@implementation-roadmap` to get task-specific guidance
- Rules can be fetched individually using the `fetch_rules` tool
- Each rule contains specific guidance for its domain

### Key Benefits
1. **Consistency**: All development follows the same specifications
2. **Performance**: Budgets are enforced throughout development
3. **Quality**: Architecture and design principles are maintained
4. **Progress**: Implementation follows the exact roadmap phases
5. **Standards**: Security, accessibility, and testing requirements are clear

## Rule Dependencies

The rules are designed to work together:
- **Bible rule** provides the foundation and references
- **Architecture rule** ensures proper design patterns
- **Workflow rule** maintains development standards
- **Performance rule** enforces budget requirements
- **Roadmap rule** guides implementation progress

## Source Documents

All rules reference these authoritative sources:
- `docs/requirements.md` - Complete framework specifications
- `docs/plan.md` - Architecture overview and roadmap phases
- `docs/tasks.md` - Granular task breakdown and implementation roadmap

## Success Criteria

These rules ensure the framework meets all success criteria:
- Real sites ship 0-10 KB JS on most routes
- Beat Next.js by ≥20% on main-thread time and initial JS
- Positive feedback from 5+ pilot teams
- Complete implementation of all three phases (A, B, C)

---

**Remember**: These rules are the authoritative guide. When in doubt, refer to the source documents they reference. Every implementation decision must align with the specifications in your documentation.
