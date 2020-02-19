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
    if (data)
      module.exports.handlePost(req.url, req, res, data);
    else
      module.exports.handleGet(req.url, res);
  });
}).listen(8000);

module.exports = {
  handlePost: (url, req, res, data) => {
    //TODO: Write to firebase logic
  },

  handleGet: (url, res) => {
    if (url == "/favicon.ico" || url == "/") return;
    let split = url.split('/');
    let coll = split[1];
    let id = split[2];
    let query;

    switch (coll) {
      case "balance":
      case "transactions":
        query = store.collection(coll).where('id', '==', id);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        query.get().then(snap => {
          snap.forEach(doc => {
            res.end(JSON.stringify(doc.data()));
          });
        });
        break;
      case "rates":
        //coincap api calls
        break;
      default:
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.write("Not Found");
        break;
    }
  }
}