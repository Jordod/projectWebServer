const https = require('https');
const fs = require('fs');
const admin = require('firebase-admin');
const serviceAccount = require("./creds.json");

const options = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://tud-4year-project-257618.firebaseio.com"
});

const store = admin.firestore();

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
      module.exports.handlePost(req.url, req, res, data);
    else
      module.exports.handleGet(req.url, res);
  });
}).listen(8000);



module.exports = {
  getBalance: async (id) => {
    let query = store.collection('balance').where('id', '==', id);
    let data = await query.get();
    return data.docs[0];
  },

  getRates: (curr, callback) => {
    const options = {
      'method': 'GET',
      'hostname': 'api.coincap.io',
      'path': `/v2/rates/${curr}`
    };

    var req = https.request(options, function (res) {
      var chunks = [];

      res.on("data", function (chunk) {
        chunks.push(chunk);
      });

      res.on("end", function (chunk) {
        var body = Buffer.concat(chunks);
        callback(JSON.parse(body));
      });

      res.on("error", function (error) {
          /* istanbul ignore next */ throw error;
      });
    });
    req.end();
  },

  handlePost: (url, req, res, data) => {
    let id = url.split('/')[1];
    try {
      data = JSON.parse(data);
    } catch (e) {
      res.writeHead(400);
      res.end("Bad Request");
      return;
    }
    let date = {
      "_seconds": Date.now(),
      "_nanoseconds": 0
    }
    module.exports.getRates("bitcoin");

    res.end(JSON.stringify(id));
  },

  handleGet: (url, res) => {
    if (url == "/favicon.ico" || url == "/") return;
    let split = url.split('/');
    let coll = split[1];
    let id = split[2];
    let query;

    switch (coll) {
      case "balance":
        query = store.collection(coll).where('id', '==', id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        query.get().then(snap => {
          snap.forEach(doc => {
            res.end(JSON.stringify(doc.data()));
          });
        });
      case "transactions":
        let transactions = [];
        query = store.collection(coll).where('id', '==', id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        query.get().then(snap => {
          snap.forEach(doc => {
            transactions.push(doc.data());
          });
          res.end(JSON.stringify(transactions));
        });
        break;
      case "rates":
        //coincap api calls
        break;
      default:
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.write("Not Found");
        res.end();
        break;
    }
  }
}