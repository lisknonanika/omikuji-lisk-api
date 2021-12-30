const { apiClient, cryptography, transactions } = require('@liskhq/lisk-client');
const config = require('./config/accounts.json');
const schema = require('./config/schema.json');
const randomNumber = require('random-number-csprng');
const express = require('express');
const app = express();
const port = 3000;
const PASSWORD = 'password';
const ATARISU = 10;
const KIGEN = 1641258000;
let NETWORK_ID = undefined;

BigInt.prototype.toJSON = function() { return this.toString(); }
Buffer.prototype.toJSON = function() { return cryptography.bufferToHex(this); }

const createClient = async() => {
    return await apiClient.createWSClient('http://localhost:8080/ws');
}

const setNetworkId = async() => {
    if (NETWORK_ID) return;
    let client = undefined;
    try {
        client = await createClient();
        const node = await client.node.getNodeInfo();
        NETWORK_ID = node.networkIdentifier;
    } finally {
        if (client) await client.disconnect();
    }
}

const getPassphrase = async() => {
    return config[await randomNumber(0, config.length - 1)].passphrase;
}

const getTosensha = async(kekka) => {
    const tosensha = [];

    // 対象者を重複なしで取得
    let taishoshas = kekka.filter(v => { return v.jikan <= KIGEN }).map(v => { return v.name });
    taishoshas = Array.from(new Set(taishoshas));
    
    if (taishoshas.length === 0) return [];
    if (taishoshas.length === 1) return [taishoshas[0]];
    while (tosensha.length < ATARISU) {
        const taishosha = taishoshas[await randomNumber(0, taishoshas.length - 1)];
        tosensha.push(taishosha);
        taishoshas = taishoshas.filter(v => { return v !== taishosha });
        if (taishoshas.length === 1 && tosensha.length < ATARISU) {
            tosensha.push(taishoshas[0]);
            break;
        }
        if (tosensha.length === ATARISU) break;
    }
    return tosensha;
}

const sendTransaction = async(client, param, passphrase, schema) => {
    client = await createClient();
    let tx = await client.transaction.create( param, passphrase );
    tx = transactions.signTransaction(
        schema,
        tx,
        Buffer.from(NETWORK_ID, 'hex'),
        passphrase
    );
    return await client.transaction.send(tx);
}

app.get('/api/omikuji/pull', async(req, res) => {
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
            asset: {
                address: req.query.address || '',
                name: req.query.name || '',
                jikan: Math.floor(new Date().getTime() / 1000)
            }
        }
        const id = await sendTransaction(client, param, passphrase, schema.pull);
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
        const tosensha = await getTosensha(ret);
        const password = req.query.password;

        // テスト実行の場合はトランザクションは送信しない
        if (!password || password !== PASSWORD) {
            res.json({ result: true, id: '', data: tosensha});
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
            asset: { name: tosensha, atarisu: ATARISU }
        }
        const id = await sendTransaction(client, param, passphrase, schema.atari);
        res.json({ result: true, id: id, data: tosensha});


    } catch(err) {
        res.json({ result: false, msg: err.message });
    } finally {
        if (client) await client.disconnect();
    }
});

app.get('/api/omikuji/kekka', async(req, res) => {
    let client = undefined;
    try {
        client = await createClient();
        const ret = await client.invoke('omikuji:omikujiKekka');
        let kekka = ret;

        // filter適用
        const address = req.query.address;
        if (address) {
            kekka = kekka.filter(v => { return v.address === address });
        }
        const name = req.query.name;
        if (name) {
            kekka = kekka.filter(v => { return v.name === name });
        }
        res.json({ result: true, data: kekka});

    } catch(err) {
        res.json({ result: false, msg: err.message });
    }finally {
        if (client) await client.disconnect();
    }
});

app.get('/api/omikuji/tosensha', async(req, res) => {
    let client = undefined;
    try {
        client = await createClient();
        const ret = await client.invoke('omikuji:omikujiAtari');
        res.json({ result: true, data: ret});

    } catch(err) {
        res.json({ result: false, msg: err.message });
    }finally {
        if (client) await client.disconnect();
    }
});

app.get('/api/omikuji/account', async(req, res) => {
    let client = undefined;
    try {
        client = await createClient();
        const ret = await client.account.get(cryptography.getAddressFromBase32Address(req.query.address));
        res.json({ result: true, data: ret});

    } catch(err) {
        res.json({ result: false, msg: err.message });
    }finally {
        if (client) await client.disconnect();
    }
});

app.get('/api/omikuji/transaction', async(req, res) => {
    let client = undefined;
    try {
        client = await createClient();
        const ret = await client.transaction.get(req.query.id);
        res.json({ result: true, data: ret});

    } catch(err) {
        res.json({ result: false, msg: err.message });
    }finally {
        if (client) await client.disconnect();
    }
});

app.get('/api/omikuji/node', async(req, res) => {
    let client = undefined;
    try {
        client = await createClient();
        const ret = await client.node.getNodeInfo();
        res.json({ result: true, data: ret});

    } catch(err) {
        res.json({ result: false, msg: err.message });
    }finally {
        if (client) await client.disconnect();
    }
});

app.listen(port, async() => {
    console.log(`api start -> http://localhost:${port}`);
    await setNetworkId();
})