import {
  LanguageDescription,
  LanguageSupport,
  StreamLanguage,
  type StreamParser,
} from '@codemirror/language'

/** Support for a language from `@codemirror/legacy-modes`, which only tokenizes. */
const legacy = <State>(parser: StreamParser<State>): LanguageSupport =>
  new LanguageSupport(StreamLanguage.define(parser))

/**
 * Languages for fenced code blocks, matched by name or alias against the info string (```` ```ts
 * ````). Each loads on first use, so none of them add to the main bundle.
 *
 * `@codemirror/lang-markdown` imports `@codemirror/lang-html`, which imports the CSS and
 * JavaScript languages, so the bundler puts any of those three in the main bundle once used, even
 * from a dynamic import. The web languages therefore use the legacy modes, which only tokenize, but
 * load lazily; `@codemirror/language-data` can't be used for the same reason.
 */
export const codeLanguages: readonly LanguageDescription[] = [
  LanguageDescription.of({
    name: 'C',
    alias: ['h'],
    load: () => import('@codemirror/lang-cpp').then(({ cpp }) => cpp()),
  }),
  LanguageDescription.of({
    name: 'C++',
    alias: ['cpp', 'cc', 'cxx', 'hpp'],
    load: () => import('@codemirror/lang-cpp').then(({ cpp }) => cpp()),
  }),
  LanguageDescription.of({
    name: 'C#',
    alias: ['csharp', 'cs'],
    load: () => import('@codemirror/legacy-modes/mode/clike').then(({ csharp }) => legacy(csharp)),
  }),
  LanguageDescription.of({
    name: 'CSS',
    load: () => import('@codemirror/legacy-modes/mode/css').then(({ css }) => legacy(css)),
  }),
  LanguageDescription.of({
    name: 'Diff',
    alias: ['patch'],
    load: () => import('@codemirror/legacy-modes/mode/diff').then(({ diff }) => legacy(diff)),
  }),
  LanguageDescription.of({
    name: 'Dockerfile',
    alias: ['docker'],
    load: () =>
      import('@codemirror/legacy-modes/mode/dockerfile').then(({ dockerFile }) =>
        legacy(dockerFile),
      ),
  }),
  LanguageDescription.of({
    name: 'Go',
    alias: ['golang'],
    load: () => import('@codemirror/lang-go').then(({ go }) => go()),
  }),
  LanguageDescription.of({
    name: 'HTML',
    alias: ['htm', 'xhtml'],
    load: () => import('@codemirror/legacy-modes/mode/xml').then(({ html }) => legacy(html)),
  }),
  LanguageDescription.of({
    name: 'Java',
    load: () => import('@codemirror/lang-java').then(({ java }) => java()),
  }),
  LanguageDescription.of({
    name: 'JavaScript',
    alias: ['js', 'mjs', 'cjs', 'node', 'jsx'],
    load: () =>
      import('@codemirror/legacy-modes/mode/javascript').then(({ javascript }) =>
        legacy(javascript),
      ),
  }),
  LanguageDescription.of({
    name: 'JSON',
    alias: ['json5', 'jsonc'],
    load: () => import('@codemirror/legacy-modes/mode/javascript').then(({ json }) => legacy(json)),
  }),
  LanguageDescription.of({
    name: 'Kotlin',
    alias: ['kt', 'kts'],
    load: () => import('@codemirror/legacy-modes/mode/clike').then(({ kotlin }) => legacy(kotlin)),
  }),
  LanguageDescription.of({
    name: 'Lua',
    load: () => import('@codemirror/legacy-modes/mode/lua').then(({ lua }) => legacy(lua)),
  }),
  LanguageDescription.of({
    name: 'PowerShell',
    alias: ['ps1', 'pwsh'],
    load: () =>
      import('@codemirror/legacy-modes/mode/powershell').then(({ powerShell }) =>
        legacy(powerShell),
      ),
  }),
  LanguageDescription.of({
    name: 'Python',
    alias: ['py'],
    load: () => import('@codemirror/lang-python').then(({ python }) => python()),
  }),
  LanguageDescription.of({
    name: 'Ruby',
    alias: ['rb'],
    load: () => import('@codemirror/legacy-modes/mode/ruby').then(({ ruby }) => legacy(ruby)),
  }),
  LanguageDescription.of({
    name: 'Rust',
    alias: ['rs'],
    load: () => import('@codemirror/lang-rust').then(({ rust }) => rust()),
  }),
  LanguageDescription.of({
    name: 'Shell',
    alias: ['bash', 'sh', 'zsh', 'console'],
    load: () => import('@codemirror/legacy-modes/mode/shell').then(({ shell }) => legacy(shell)),
  }),
  LanguageDescription.of({
    name: 'SQL',
    load: () => import('@codemirror/lang-sql').then(({ sql }) => sql()),
  }),
  LanguageDescription.of({
    name: 'Swift',
    load: () => import('@codemirror/legacy-modes/mode/swift').then(({ swift }) => legacy(swift)),
  }),
  LanguageDescription.of({
    name: 'TOML',
    load: () => import('@codemirror/legacy-modes/mode/toml').then(({ toml }) => legacy(toml)),
  }),
  LanguageDescription.of({
    name: 'TypeScript',
    alias: ['ts', 'mts', 'cts', 'tsx'],
    load: () =>
      import('@codemirror/legacy-modes/mode/javascript').then(({ typescript }) =>
        legacy(typescript),
      ),
  }),
  LanguageDescription.of({
    name: 'XML',
    alias: ['svg', 'xsl', 'xsd'],
    load: () => import('@codemirror/lang-xml').then(({ xml }) => xml()),
  }),
  LanguageDescription.of({
    name: 'YAML',
    alias: ['yml'],
    load: () => import('@codemirror/lang-yaml').then(({ yaml }) => yaml()),
  }),
]
