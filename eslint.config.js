import js from '@eslint/js';
import ts from 'typescript-eslint';
export default ts.config({ignores:['dist/**','dist-desktop/**','desktop-build/**','release/**','desktop-resources/**','.runtime/**','node_modules/**']},js.configs.recommended,...ts.configs.recommended,{files:['scripts/*.mjs','desktop/*.cjs','desktop/*.js'],languageOptions:{globals:{process:'readonly',console:'readonly',require:'readonly',window:'readonly',document:'readonly'}}},{
  files:['**/*.ts'], rules:{'@typescript-eslint/no-unused-vars':['error',{argsIgnorePattern:'^_'}]}
},{files:['desktop/preload.cjs'],rules:{'@typescript-eslint/no-require-imports':'off'}
});
