const https = require('https');
const trade = require('./tradeLogic');
const fs = require('fs');

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

//server
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
    if (data.length > 0)
    trade.handleTrade(res, data);
    else
    trade.handleGet(req.url, res);
  });
}).listen(8000);