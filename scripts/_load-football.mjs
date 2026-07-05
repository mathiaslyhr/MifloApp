// Shared loader: pull the TypeScript football dataset into a plain Node script.
//
// The dataset (src/data/football/*.ts) is the single source of truth, but it is
// TypeScript with extensionless relative imports, so `node` can't import it
// directly. We register an on-the-fly `.ts` require hook backed by @babel/core +
// the project's own RN Babel preset (already a devDependency), then require the
// barrel. Used by build-football-json / build-flag-assets / build-logo-assets.
import babel from '@babel/core';
import Module from 'node:module';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Compile each imported .ts file (TS → CJS) so plain `require` can load it.
// Registering `.ts` in Module._extensions also lets extensionless requires
// (`./types`) resolve to `types.ts`, matching how Metro/Jest resolve them.
Module._extensions['.ts'] = (module, filename) => {
  const source = readFileSync(filename, 'utf8');
  const {code} = babel.transformSync(source, {
    filename,
    babelrc: false,
    configFile: false,
    presets: ['module:@react-native/babel-preset'],
  });
  module._compile(code, filename);
};

const require = createRequire(import.meta.url);

// The football barrel re-exports FOOTBALLERS + CLUBS (and helpers).
const football = require(resolve(root, 'src/data/football/index.ts'));

export const FOOTBALLERS = football.FOOTBALLERS;
export const CLUBS = football.CLUBS;
export {root};
