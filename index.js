const { Conn } = require('@rob9315/mcproxy');
const mc = require('minecraft-protocol');
const EventEmitter = require('events');
require('dotenv').config();
let client2b2t, proxy;

class Client2b2t extends EventEmitter{
    #options = {
        username: 'username',
        host: process.env.SERVER_HOST,
        port: process.env.SERVER_PORT,
        version: '1.12.2',
        profilesFolder: './accounts'
    };
    #server;
    #client;
    #positionInQueue;
    #inQueue;

    constructor(options){
        super();
        this.#options = {...this.#options, ...options};
    }

    disconnect(){
        if(this.#server){
            this.#server.disconnect();
            this.#server = null;
        }
    }

    connect(){
        this.disconnect();
        this.#server = new Conn(this.#options);
        this.#client = this.#server.bot._client;
        this.#inQueue = true;

        this.#client.on("packet", (data, meta) => {
            switch (meta.name) {
                case "playerlist_header":
                    if (this.#inQueue) {
                        const headerMessage = JSON.parse(data.header);
                        try {
                            this.#positionInQueue = parseInt(headerMessage.text.split("\n")[5].substring(25));
                            this.#inQueue = true;
                            super.emit('queueAdvance', this.#positionInQueue);
                        } catch (e) {}
                    }
                    break;
                case "chat":
                    if (this.#inQueue) {
                        let chatMessage = JSON.parse(data.message);
                        if (chatMessage.text && chatMessage.text === "Connecting to the server...") {
                            this.#positionInQueue = 0;
                            this.#inQueue = false;
                            super.emit('queueAdvance', this.#positionInQueue);
                            super.emit('queueComplete');
                        }
                    }
                    break;
            }
        });

        this.#client.on('end', () => {
            super.emit('disconnect', arguments);
        });
        this.#client.on('error', () => {
            super.emit('disconnect', arguments);
        });
    }

    get inQueue(){
        return this.#inQueue;
    }

    get positionInQueue(){
        return this.#positionInQueue;
    }

    get server(){
        return this.#server;
    }

    get client(){
        return this.#client;
    }
}

proxy = mc.createServer({
    'online-mode': false,
    encryption: true,
    host: '0.0.0.0',
    port: 25565,
    version: '1.12.2',
    'max-players': 1,
    motd: 'Proxy started, but not connected to server!',
});
proxy.on('login', (client) => {
    const server = (client2b2t) ? client2b2t.server : null;
    try{
        server.generatePackets()[0][1].entityId;
    }catch (e) {
        client.end("Proxy not connected to 2b2t!");
        return;
    }

    // Spawn on "space" location
    client.write('login', {
        entityId: server.generatePackets()[0][1].entityId,
        gameMode: 3,
        dimension: 1,
        difficulty: 0,
        levelType: 'flat'
    });
    client.write('position', { x: 0, y: 240, z: 0, yaw: 0, pitch: 0, flags: 0, teleportId: 1 });
    client.write('chat', { message: JSON.stringify({ text: '§6§o§l4bored4wait§r\n' +
                'Password required! Use §l/login §e<password>§r' }) });

    client.on("end", () => {
        //startAntiAntiAFK();
    })

    let linkedWith2b2t = false;
    client.on("chat", (data) => {
        if(!linkedWith2b2t && data && data.message[0] === '/'){
            const userInput = data.message.slice(1).split(" ");
            switch(userInput[0]){
                case 'login':
                    if(!userInput[1]){
                        client.write('chat', { message: JSON.stringify({ text: 'Use §l/login §e<password>§r' })});
                    }else{
                        if(client.username === process.env.PROXY_USERNAME && userInput[1] === process.env.PROXY_PASSWORD){
                            // Send all packages expect first 'login' package
                            if(!server) {
                                client.end("Proxy not connected to 2b2t!");
                                break;
                            }
                            linkedWith2b2t = true;
                            for (let packet of server.generatePackets().slice(1)) {
                                client.write(packet[0], packet[1]);
                            }
                            server.link(client);
                            break;
                        }else{
                            client.write('chat', { message: JSON.stringify({ text: '§cWrong password! Try again!§r' })});
                        }
                    }
                    break;
            }
        }
    });
});

function start2b2t(){
    if(client2b2t){
        client2b2t.disconnect();
        client2b2t = null;
    }
    mc.ping({host: process.env.SERVER_HOST, port: process.env.SERVER_PORT}, (err) => {
        if(err){
            console.error('Ping not send to 2b2t!');
            reconnectTimeouted();
        }
        else {
            console.log('Yay! Successfully pinged to 2b2t!');
            client2b2t = new Client2b2t({
                username: process.env.MINECRAFT_USERNAME,
                password: process.env.MINECRAFT_PASSWORD,
                auth: process.env.MINECRAFT_TYPE
            });
            client2b2t.connect();

            client2b2t.on('queueAdvance', function(pos){
                console.log(`Position in queue: ${pos}`);
                proxy.motd = `§6Position in queue: §l${pos}§r\n§6Estimated time: §l${'Coming soon...'}§r`;
            });

            client2b2t.on('queueComplete', function(){
                console.log('You can play now :)');
                proxy.motd = `§6You can play now :)§r`;
            });

            client2b2t.on('disconnect', function(data){
                console.error('DISCONNECTED!');
                console.error(data);
                proxy.motd = `§c§bDISCONNECTED!§r`;
                reconnectTimeouted();
            });
        }
    });
}

let reconnectTimeout;
function reconnectTimeouted(){
    if(reconnectTimeout) clearTimeout(reconnectTimeout);
    reconnectTimeout = setTimeout(start2b2t, 5000);
}

start2b2t();