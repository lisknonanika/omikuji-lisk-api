const { apiClient, cryptography, transactions } = require('@liskhq/lisk-client');
const config = require('./config/accounts.json');
const schema = require('./config/schema.json');
const randomNumber = require('random-number-csprng');
const express = require('express');
const app = express();
const networkId = '639cb8adbaa66448501c5bb53e25fafbf97736af6a150f8463b3165f1f10a907';
const port = 3000;
const PASSWORD = 'password';

const createClient = async() => {
    return await apiClient.createWSClient('http://localhost:8080/ws');
}

const getPassphrase = async() => {
    return config[await randomNumber(0, config.length - 1)].passphrase;
}

const sendTransaction = async(client, param, passphrase) => {
    client = await createClient();
    let tx = await client.transaction.create( param, passphrase );
    tx = transactions.signTransaction(
        schema.pull,
        tx,
        Buffer.from(networkId, 'hex'),
        passphrase
    );
    return await client.transaction.send(tx);
}

app.get('/api/omikuji/pull', async(req, res) => {
    let client = undefined;
    try {
        const passphrase = await getPassphrase();
        const param = {
            moduleID: 3535,
            assetID: 0,
            fee: BigInt(10000000),
            nonce: 0,
            senderPublicKey: cryptography.getPrivateAndPublicKeyFromPassphrase(passphrase).publicKey,
            asset: {
                address: req.address || '',
                name: req.name || '',
                jikan: Math.floor(new Date().getTime() / 1000)
            }
        }
        const id = await sendTransaction(client, param, passphrase);
        res.json({ result: true, id: id});

    } catch(err) {
        res.json({ result: false, msg: err.message });
    } finally {
        if (client) await client.disconnect();
    }
});


app.get('/api/omikuji/atari', async(req, res) => {
    let client = undefined;
    try {
        client = await createClient();

        // おみくじの結果を取得
        const ret = await client.invoke('omikuji:omikujiKekka');
        const tousensha = [];

        // TODO 当選者取得


        const password = req.password;

        // テスト実行の場合はトランザクションは送信しない
        if (!password || password !== PASSWORD) {
            res.json({ result: true, id: '', tousensha: tousensha});
            return;
        }
        
        // 当選者確定時はトランザクションを送信
        const passphrase = await getPassphrase();
        const param = {
            moduleID: 3535,
            assetID: 1,
            fee: BigInt(10000000),
            nonce: 0,
            senderPublicKey: cryptography.getPrivateAndPublicKeyFromPassphrase(passphrase).publicKey,
            asset: { name: tousensha, atarisu: 10 }
        }
        const id = await sendTransaction(client, param, passphrase);
        res.json({ result: true, id: id, tousensha: tousensha});


    } catch(err) {
        res.json({ result: false, msg: err.message });
    } finally {
        if (client) await client.disconnect();
    }
});

app.get('/api/omikuji/kekka', async(req, res) => {
    let client = undefined;
    try {
        const address = req.address;
        const name = req.name;
        client = await createClient();
        const ret = await client.invoke('omikuji:omikujiKekka');
        res.json({ result: true, data: ret.omikujiKekka});

    } catch(err) {
        res.json({ result: false, msg: err.message });
    }finally {
        if (client) await client.disconnect();
    }
});

app.get('/api/omikuji/tousensha', async(req, res) => {
    let client = undefined;
    try {
        client = await createClient();
        const ret = await client.invoke('omikuji:omikujiAtari');
        res.json({ result: true, data: ret.omikujiAtari});

    } catch(err) {
        res.json({ result: false, msg: err.message });
    }finally {
        if (client) await client.disconnect();
    }
});

app.listen(port, () => {
    console.log(`api start -> http://localhost:${port}`)
})