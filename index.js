const { Conn } = require('@rob9315/mcproxy');
const mc = require('minecraft-protocol');
let server, serverClient, proxy, proxyClient;

function start(){
    server = new Conn({
        username: `TestUser`,
        host: 'localhost',
        port: 25566,
        version: '1.12.2'
    });
    serverClient = server.bot._client;

    serverClient.on("packet", (data, meta) => {
        /*switch(meta.name){
            case 'login':
                serverClientData = data;
                break;
        }*/
    });
	
    /*
    serverClient.on("packet", (data, meta) => {
		switch (meta.name) {
			case "playerlist_header":
				if (!finishedQueue && is2B2T) {
					let headermessage = JSON.parse(data.header);
					try {
						positionInQueue = Number(headermessage.text.split("\n")[5].substring(25));
					} catch (e) {
						if (e instanceof TypeError)
							console.log("Reading position in queue from tab failed! Is the queue empty, or the server isn't 2b2t?");
					}
				}
				break;
			case "chat":
				if (finishedQueue === false) {
					finishedQueue = true;
					startAntiAntiAFK();
				}
				break;
		}
	});
     */

    proxy = mc.createServer({
        'online-mode': false,
        encryption: true,
        host: '0.0.0.0',
        port: 25565,
        version: '1.12.2',
        'max-players': 1
    });
    proxy.on('login', (client) => {
        // Spawn on "space" location
        client.write('login', {
            entityId: server.generatePackets()[0][1].entityId,
            gameMode: 3,
            dimension: 1,
            difficulty: 0,
            levelType: 'flat'
        });
        client.write('position', { x: 0, y: 240, z: 0, yaw: 0, pitch: 0, flags: 0, teleportId: 1 });

        // Events
        client.on("end", () => {
            //startAntiAntiAFK();
        })
        client.on("chat", (data) => {
            if(data && data.message === 'login'){
                // Send all packages expect first 'login' package
                for(let packet of server.generatePackets().slice(1)){
                    client.write(packet[0], packet[1]);
                }
                server.link(client);
            }
        });

        proxyClient = client;
    });
}

start();