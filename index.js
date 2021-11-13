const { Conn } = require('@rob9315/mcproxy');
const mc = require('minecraft-protocol');
const EventEmitter = require('events');
let client2b2t, proxy;

class Client2b2t extends EventEmitter{
    #username;
    #password;
    #server;
    #client;
    #host = '2b2t.org';
    #port = 25565;
    #positionInQueue;
    #inQueue;

    constructor(options){
        super();
        let { username, password, host, port } = options;
        this.#username = username;
        this.#password = password;
        this.#host = host || this.#host;
        this.#port = port || this.#port;
    }

    connect(){
        this.#server = new Conn({
            username: this.#username,
            password: this.#password,
            host: this.#host,
            port: this.#port,
            version: '1.12.2'
        });
        this.#client = this.#server.bot._client;
        this.#inQueue = true;

        this.#client.on("packet", (data, meta) => {
            switch (meta.name) {
                case "playerlist_header":
                    if (this.#inQueue) {
                        const headerMessage = JSON.parse(data.header);
                        try {
                            console.log(headerMessage);
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

function start(){
    client2b2t = new Client2b2t({
        username: ``,
        password: ``
    });
    client2b2t.connect();

    proxy = mc.createServer({
        'online-mode': false,
        encryption: true,
        host: '0.0.0.0',
        port: 25565,
        version: '1.12.2',
        'max-players': 1
    });
    proxy.on('login', (client) => {
        const server = client2b2t.server;
        if(!server) {
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
                            break;
                        }else{
                            client.write('chat', { message: JSON.stringify({ text: '§cWrong password! Try again!§r' })});
                            break;
                        }
                        break;
                    // TODO: Don't forget to remove!
                    case 'testConnect':
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
                }
            }
        });
    });

    client2b2t.on('queueAdvance', function(pos){
        proxy.motd = `§6Position in queue: §l${pos}§r\n§6Estimated time: §l${'Coming soon...'}§r`;
    });

    client2b2t.on('queueComplete', function(){
        proxy.motd = `§6You can play now :)§r`;
    });
}

start();