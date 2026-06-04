---
name: angular-lint
description: Run Angular lint checks aligned to Angular 21 best practices, even when v22 is available. Use for lint command generation, CI linting, and code-quality validation for Angular source and templates.
---

# Angular Lint

## Purpose

- Run Angular and ESLint validation for Angular 21 applications.
- Enforce Angular v21 coding conventions and modern Angular ESLint rules.
- Validate TypeScript, templates, and Angular-specific quality checks.

## When to use

- Generating or reviewing lint scripts and commands.
- Enforcing Angular 21 code quality before merges or releases.
- Adding Angular linting to CI workflows.

## Recommended commands

- `pnpm lint`
- `pnpm lint:fix`
- `pnpm eslint "src/**/*.{ts,html}" --ext .ts,.html`
- `pnpm eslint --fix "src/**/*.{ts,html}"`

## Best-practice lint rules

- `@angular-eslint/template/no-negated-async`
- `@angular-eslint/use-lifecycle-interface`
- `@angular-eslint/no-output-native`
- `@angular-eslint/no-input-rename`
- `@angular-eslint/no-host-metadata-property`
- `@angular-eslint/component-class-suffix`
- `@angular-eslint/directive-class-suffix`
- `@angular-eslint/no-queries-metadata-property`
- `@angular-eslint/no-empty-lifecycle-method`
- `@angular-eslint/no-conflicting-lifecycle`

## Notes

- Target Angular 21 best practices even if Angular 22 is available.
- Lint both `.ts` and `.html` files to catch template-level issues.
- Prefer using the project’s existing `ng lint` script for consistency.
