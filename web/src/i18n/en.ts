import type zh from './zh'

const en: typeof zh = {
  header: { docs: 'Docs', lang: 'Language', theme: { toDark: 'Switch to dark mode', toLight: 'Switch to light mode' }, github: 'GitHub repository', menu: 'Menu', darkLabel: 'Dark mode' },
  title: 'Create a mugsun project',
  subtitle: 'Choose modules and fill in the project details to generate a project that runs out of the box.',
  offline: 'You are offline. Generation will be available again once the connection is restored.',
  info: { title: 'Project details', scope: 'Generation scope', meta: 'Project metadata', build: 'Build settings' },
  form: {
    group: 'Group', artifact: 'Artifact', name: 'Project name', packageName: 'Package name', description: 'Description', database: 'Database',
    databaseHint: 'Only PostgreSQL is supported in this release', restore: 'Restore automatic value', boot: 'Spring Boot', java: 'JDK', packaging: 'Packaging',
    err: {
      groupRequired: 'Enter a group.',
      group: 'The group can only contain lowercase letters, digits, underscores and dots, and cannot start with a digit.',
      artifactRequired: 'Enter an artifact.',
      artifact: 'The artifact can only contain lowercase letters, digits and hyphens, must start with a letter and can be up to 50 characters.',
      nameRequired: 'Enter a project name.',
      name: 'The project name can be up to 50 characters.',
      packageRequired: 'Enter a package name.',
      packageName: 'The package name must be dot-separated segments of lowercase letters, digits and underscores. Segments cannot start with a digit or be a Java keyword.',
      description: 'The description can be up to 200 characters.'
    }
  },
  modules: {
    title: 'Modules', included: 'Included', docs: 'Docs', docsAria: '{name} documentation (opens in a new window)',
    notApplicable: 'This module does not apply to the selected generation scope.',
    loadError: 'The module list could not be loaded. Check your network connection and try again.', retry: 'Retry'
  },
  preview: { title: 'Project structure', files: '{n} files', empty: 'There are no files to preview', updated: 'Project structure updated, {n} files' },
  bar: {
    summary: '{scope} · {n} optional modules selected · {pkg}',
    share: 'Copy share link', shared: 'Share link copied', download: 'Download ZIP', generating: 'Generating…',
    shortcut: 'Shortcut: {key} + Enter', slow: 'Generation is taking longer than usual. Please wait.', guide: 'Getting started',
    disabledMeta: 'Generation is unavailable because the module list could not be loaded',
    invalid: '{n} fields need to be corrected',
    failed: 'Generation failed. Try again later. (Error ID: {id})'
  },
  drawer: {
    title: 'Project generated', env: 'Requirements', commands: 'Commands', copy: 'Copy', copied: 'Copied',
    access: 'URL and default account',
    accessText: 'The URL and the default administrator account are described in the "Quick start" section of the project README. Passwords are not shown on this page.',
    docs: 'Read the full documentation'
  }
}
export default en
