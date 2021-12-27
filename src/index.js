const { apiClient } = require('@liskhq/lisk-client');

(async() => {
    let client = undefined;
    try {
        client = await apiClient.createWSClient('http://localhost:8080/ws');
        const kekka = await client.invoke('omikuji:omikujiKekka');
        console.log(kekka.slice(-3))

    } catch(err) {
        console.error(err);
    } finally {
        if (client) await client.disconnect();
    }
})();