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

// store.collection("transactions").listDocuments().then(
//   x => x[0].get().then(y => {
//     console.log(y.data());
//   })
// );

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