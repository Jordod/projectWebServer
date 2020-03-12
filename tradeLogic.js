const admin = require('firebase-admin');
const https = require('https');
const serviceAccount = require("./creds.json");

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://tud-4year-project-257618.firebaseio.com"
});

const store = admin.firestore();

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

        if (data.sell == undefined) {
            if (data.buy == undefined) return false;
            switch (data.buy) {
                case "bitcoin":
                case "litecoin":
                case "usd":
                    return true;
                default:
                    return false;
            }
        } else if (data.buy == undefined) {
            if (data.sell == undefined) return false;
            switch (data.sell) {
                case "bitcoin":
                case "litecoin":
                    return true;
                default:
                    return false;
            }
        } else return false;


    },

    writeTransaction: async (doc) => {
        doc.date = Date.now();
        await store.collection("transactions").add(doc);
    },

    handleTrade: async (res, data) => {
        try {
            data = JSON.parse(data);
            if (!module.exports.verifyData(data)) throw new Exception();
            console.log(data);
        } catch (e) {
            res.writeHead(400);
            res.end("Bad Request");
            return;
        }

        if (data.sell == undefined)
            module.exports.handleBuy(res, data);
        else
            module.exports.handleSell(res, data);

    },

    updateBalance: async (ref, bal) => {
        await ref.ref.update(bal);
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
                break;
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
        query.get().then(snap => {
            if (snap.empty) {
                module.exports.completeQueryReq(res, store.collection('balance').where('id', '==', '0'));
            } else {
                snap.forEach(doc => {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify(doc.data()));
                });
            }
        });
    },

    handleBuy: async (res, data) => {
        let balanceRef = await module.exports.getBalance(data.id);
        if (balanceRef == undefined) { res.end(JSON.stringify("No Account")); return; };
        let balance = balanceRef.data();

        //here's the trade calls
        if (data.buy == 'usd') { //topup first
            balance.amtUSD += data.amount;
            await module.exports.updateBalance(balanceRef, balance);
            await module.exports.writeTransaction(data);
            res.end(JSON.stringify("Success"));
        } else {
            module.exports.getRates(data.buy, async (rate) => {
                let amtToBuyUSD = data.amount * rate.rateUsd;
                if (balance.amtUSD - amtToBuyUSD < 0) {
                    res.end(JSON.stringify("Insuffuicent balance"));
                } else {
                    balance.cryptoBals[data.buy] += data.amount
                    balance.amtUSD -= amtToBuyUSD;
                    await module.exports.updateBalance(balanceRef, balance)
                    await module.exports.writeTransaction(data);
                    res.end(JSON.stringify("Success"));
                }
            });
        }
    },



    handleSell: async (res, data) => {
        let balanceRef = await module.exports.getBalance(data.id);
        if (balanceRef == undefined) { res.end(JSON.stringify("No Account")); return; };
        let balance = balanceRef.data();


        module.exports.getRates(data.sell, async (rate) => {
            let amtToGet = data.amount * rate.rateUsd;
            let finalBalance = balance.cryptoBals[data.sell] - data.amount
            if (finalBalance < 0) {
                res.end(JSON.stringify("Insuffuicent balance"));
            } else {
                balance.cryptoBals[data.sell] = finalBalance;
                balance.amtUSD += amtToGet;
                await module.exports.updateBalance(balanceRef, balance)
                await module.exports.writeTransaction(data);
                res.end(JSON.stringify("Success"));
            }
        });

    }
}