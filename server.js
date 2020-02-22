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
      module.exports.handleTrade(res, data);
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
        callback(JSON.parse(body).data);
      });

      res.on("error", function (error) {
          /* istanbul ignore next */ throw error;
      });
    });
    req.end();
  },

  verifyData: (data) => {
    if (data.id == undefined) return false;
    if (data.amount <= 0 || data.amount == undefined) return false;
    if (data.buy == undefined) return false;
    switch (data.buy) {
      case "ripple":
      case "bitcoin":
      case "litecoin":
        return true;
      default:
        return false;
    }
  },

  updateBalance: (ref, doc, usdAmt) => {
    let bal = ref.data();
    bal.cryptoBals[doc.buy] += doc.amount;
    bal.amtUSD -= usdAmt;
    ref.ref.update(bal); //QueryDocRef -> DocRef update()
  },

  writeTransaction: (doc) => {
    doc.date = Date.now();
    store.collection("transactions").add(doc);
  },

  handleTrade: async (res, data) => {
    try {
      data = JSON.parse(data);
      if (!module.exports.verifyData(data)) throw new Exception();
    } catch (e) {
      res.writeHead(400);
      res.end("Bad Request");
      return;
    }

    let balanceRef = await module.exports.getBalance(data.id);
    let balance = balanceRef.data();

    //here's the trade calls
    module.exports.getRates(data.buy, (rate) => {
      let amtToBuyUSD = data.amount * rate.rateUsd;
      if (balance.amtUSD - amtToBuyUSD < 0) {
        res.end(JSON.stringify("Insuffuicent balance"));
      } else {
        module.exports.updateBalance(balanceRef, data, amtToBuyUSD)
        module.exports.writeTransaction(data);
        res.end(JSON.stringify("Success"));
      }
    });
  },

  handleGet: (url, res) => {
    let split = url.split('/');
    let coll = split[1];
    let id = split[2];
    let query;

    switch (coll) {
      case "balance":
        query = store.collection(coll).where('id', '==', id);
        module.exports.completeQueryReq(res, query);
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
      case "default":
        query = store.collection('balance').where('id', '==', '0');//default id
        module.exports.completeQueryReq(res, query);
        break;
      default:
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.write("Not Found");
        res.end();
        break;
    }
  },

  completeQueryReq: (res, query) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    query.get().then(snap => {
      snap.forEach(doc => {
        res.end(JSON.stringify(doc.data()));
      });
    });
  }
}