const https = require('https');
const fs = require('fs');

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

https.createServer(options, function (req, res) {
  var chunks = [];

  req.on("data", (chunk) => {
    chunks.push(chunk);
  });

  req.on("error", (error) => {
    /* istanbul ignore next */ throw error;
  });

  req.on("end", () => {
    var data = Buffer.concat(chunks);
    data = JSON.parse(data);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.write(JSON.stringify(data)); //Will Return Empty Obj if trade fails
    res.end();
  });
}).listen(8000);