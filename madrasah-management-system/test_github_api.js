import https from 'https';

function fetchGithub(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: path,
      method: 'GET',
      headers: {
        'User-Agent': 'NodeJS-Agent'
      }
    };

    https.get(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
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
  const repos = [
    '/repos/maateen/bengali-fonts/contents',
    '/repos/SazzadSaju/react-bangla-font/contents'
  ];

  for (const repo of repos) {
    try {
      console.log(`\nFetching ${repo}...`);
      const contents = await fetchGithub(repo);
      console.log('Contents:');
      contents.forEach(item => {
        console.log(`- ${item.name} (${item.type})`);
      });
    } catch (err) {
      console.error(`Error fetching ${repo}: ${err.message}`);
    }
  }
}

run();
