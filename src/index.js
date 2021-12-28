const { apiClient, cryptography, transactions } = require('@liskhq/lisk-client');
const config = require('./config/accounts.json');
const schema = require('./config/schema.json');
const randomNumber = require('random-number-csprng');
const express = require('express');
const app = express();
const networkId = '639cb8adbaa66448501c5bb53e25fafbf97736af6a150f8463b3165f1f10a907';

const createClient = async() => {
    return await apiClient.createWSClient('http://localhost:8080/ws');
}

const getPassphrase = async() => {
    return config[await randomNumber(0, config.length - 1)].passphrase;
}

app.get("/api/omikuji/pull", async(req, res) => {
    const address = req.address;
    const name = req.name;
    if (!address || !name) {
        console.error({ result: false, msg: '必須エラー' });
        return;
    }

    let client = undefined;
    try {
        client = await createClient();
        const passphrase = await getPassphrase();
        const param = {
            moduleID: 3535,
            assetID: 0,
            fee: BigInt(10000000),
            nonce: 0,
            senderPublicKey: cryptography.getPrivateAndPublicKeyFromPassphrase(passphrase).publicKey,
            asset: { address: address, name: name, jikan: Math.floor(new Date().getTime() / 1000) }
        }
        param.fee = transactions.computeMinFee(schema.pull, param);
        let tx = await client.transaction.create( param, passphrase );
        tx = transactions.signTransaction(
            schema.pull,
            tx,
            Buffer.from(networkId, 'hex'),
            passphrase
        );
        const id = await client.transaction.send(tx);
        res.json({ result: true, id: id});

    } catch(err) {
        res.json({ result: false, msg: err.message });
    } finally {
        if (client) await client.disconnect();
    }
});
