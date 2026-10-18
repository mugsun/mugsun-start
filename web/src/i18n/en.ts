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
      packageName: 'The package name must be dot-separated segments of lowercase letters, digits and underscores. Segments cannot start with a digit, be a Java keyword or be true, false or null.',
      description: 'The description can be up to 200 characters.'
    }
  },
  modules: {
    title: 'Modules', showAll: 'Show all ({n})', showLess: 'Show less', alwaysOn: 'Included modules', optional: 'Optional modules', included: 'Included', docs: 'Docs', docsAria: '{name} documentation (opens in a new window)',
    notApplicable: 'This module does not apply to the selected generation scope.',
    loadError: 'The module list could not be loaded. Check your network connection and try again.', retry: 'Retry'
  },
  cooldown: { downloadIn: 'Download ZIP ({s}s)', retryIn: 'Retry ({s}s)', canRetry: 'You can retry now', ready: 'Too many requests. You can retry now.' },
  preview: { unsupported: 'The request contains an option that is not supported yet. Refresh the page.', invalid: 'Some project details are invalid. The preview updates once they are corrected.', error: 'The preview could not be loaded. Try again later.', requestId: 'Error ID: {id}', fromModule: 'From module: {m}', truncated: 'Some directories only show item counts because the project has many files.', stale: 'The preview could not be updated. The previous result is shown.', title: 'Project structure', files: '{n} files', empty: 'There are no files to preview', updated: 'Project structure updated, {n} files' },
  bar: {
    summary: '{scope} · {n} optional modules selected · {pkg}',
    share: 'Copy share link', shared: 'Share link copied', download: 'Download ZIP', generating: 'Generating…',
    shortcut: 'Shortcut: {key} + Enter', slow: 'Generation is taking longer than usual. Please wait.', guide: 'Getting started',
    disabledLoading: 'Generation will be available once the module list has loaded',
    disabledMeta: 'Generation is unavailable because the module list could not be loaded',
    invalid: '{n} fields need to be corrected',
    rateLimited: 'Too many requests. Try again in {s} seconds.',
    serverMessage: '{msg} (Error ID: {id})',
    unknownDependency: 'The request contains a module that does not exist. Refresh the page and try again. (Error ID: {id})',
    invalidOther: 'Invalid request. Check the project details and try again (Error ID: {id})',
    unsupported: 'The request contains an option that is not supported yet. Refresh the page and try again. (Error ID: {id})',
    rateLimitedNoWait: 'Too many requests. Try again later.',
    timeout: 'Generation timed out. Try again later.',
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
