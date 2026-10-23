import https from 'https';

function searchNpm(text) {
  return new Promise((resolve, reject) => {
    https.get(`https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(text)}`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`Status ${res.statusCode}: ${data}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  const terms = ['bangla font', 'solaimanlipi', 'bangla'];
  for (const term of terms) {
    try {
      console.log(`\nSearching NPM for: "${term}"`);
      const results = await searchNpm(term);
      console.log(`Found ${results.objects?.length || 0} results:`);
      results.objects?.slice(0, 10).forEach(item => {
        console.log(`- ${item.package.name} (${item.package.version})`);
        console.log(`  description: ${item.package.description}`);
      });
    } catch (err) {
      console.error(`- Error: ${err.message}`);
    }
  }
}

run();
