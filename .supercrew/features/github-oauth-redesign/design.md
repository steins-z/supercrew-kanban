---
status: draft
reviewers: []
---

# GitHub OAuth Experience Redesign

## Background

Streamline the GitHub sign-in flow, add a quick repo switcher in the header, and support multiple GitHub accounts. The current experience has friction: the 3-step FRE runs every time a repo switch is needed, there's no quick repo picker, and multi-account support is lacking.

## Requirements

### 1. Streamlined Sign-in Flow
- Skip FRE for returning users with a valid previously-used repo
- Combine "Welcome" + "Select Repo" into a single smart step
- Show last-used repo prominently with "Continue with `org/repo`?" one-click option

### 2. Quick Repo Switcher (Header)
- Add repo dropdown in header replacing simple "Disconnect" button
- Store and display recent repos list (last 5 used)
- Search/filter repos inline without full FRE flow

### 3. Multi-Account Support
- "Sign in with different account" link that clears session and re-authenticates
- Show current account prominently before repo selection
- Account switcher in header alongside repo switcher

### 4. Additional Improvements
- Skip SuperCrew verification as blocking step; show warning badge instead
- Remember user preferences (theme, language) per-account
- Graceful handling of expired tokens

## Design

<!-- To be refined during brainstorming -->

## Out of Scope

<!-- To be defined -->
