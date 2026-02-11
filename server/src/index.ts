import http from "http";
import { Server } from "colyseus";
import { CincoVidasRoom } from "./rooms/CincoVidasRoom";

const port = Number(process.env.PORT || 2567);

const httpServer = http.createServer((req, res) => {
    // Basic CORS
    const origin = req.headers.origin;
    if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'GET' && (req.url === '/' || req.url === '/health')) {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        return;
    }

    // Colyseus handles /matchmake/ requests via transport's request listener automatically?
    // In 0.14: yes.
    // In 0.17: server (transport) attaches request listener.
    // If we don't write to res (except headers), Colyseus listener should run.
});

const gameServer = new Server({
    server: httpServer
});

gameServer.define("cinco_vidas", CincoVidasRoom);

gameServer.listen(port);
console.log(`Listening on ws://localhost:${port}`);
