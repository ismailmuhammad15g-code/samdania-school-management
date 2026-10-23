import https from 'https';

const urls = [
  'https://github.com/Sohailreza/Bangla-Fonts',
  'https://raw.githubusercontent.com/Sohailreza/Bangla-Fonts/master/SolaimanLipi.ttf',
  'https://raw.githubusercontent.com/Sohailreza/Bangla-Fonts/master/fonts/SolaimanLipi.ttf',
  'https://raw.githubusercontent.com/Sohailreza/Bangla-Fonts/master/fonts/solaimanlipi.ttf'
];

function check(index) {
  if (index >= urls.length) return;
  const url = urls[index];
  https.get(url, (res) => {
    console.log(`URL: ${url} => Status: ${res.statusCode}`);
    res.resume();
    check(index + 1);
  }).on('error', (err) => {
    console.log(`URL: ${url} => Error: ${err.message}`);
    check(index + 1);
  });
}

check(0);
