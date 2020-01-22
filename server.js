const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

const example = {
  currFrom: 'USD',
  currTo: 'bitcoin',
  amount: '100',
  rate: '1000' //1000 US to 1 btc
}

https.createServer(options, function (req, res) {
  res.writeHead(200, {'Content-Type': 'application/json'});
  res.write(JSON.stringify(example)); //Will Return Empty Obj if trade fails
  res.end();
}).listen(8000);