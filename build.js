import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { resolve } from 'path';
import tempy from 'tempy';

import { buildSync } from 'esbuild';

const outfile = tempy.file({ extension: 'js' });

buildSync({
  entryPoints: ['index.js'],
  bundle: true,
  sourcemap: true,
  outfile,
});

writeFileSync(
  resolve('./bundle.js'),
  readFileSync(outfile, 'utf-8').replace(/(?<=\/\/# sourceMappingURL=).+/, 'bundle.js.map'),
  'utf-8'
);

copyFileSync(`${outfile}.map`, resolve('./bundle.js.map'));
