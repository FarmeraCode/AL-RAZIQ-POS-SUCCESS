
import fs from 'fs';
import pngToIco from 'png-to-ico';

pngToIco('src/assets/al-raziq-logo.png')
  .then(buf => {
    fs.writeFileSync('public/favicon.ico', buf);
    console.log('Successfully converted PNG to ICO');
  })
  .catch(err => {
    console.error('Error converting PNG to ICO:', err);
    process.exit(1);
  });
