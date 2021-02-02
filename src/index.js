const path = require('path');
const config = require('config-lite')(path.join(__dirname, '..'));
const express = require('express');
const http = require('http');
const socketio = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketio(server);

const clients = new Array();
const verified_tokens = new Array();

io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (verified_tokens.includes(token)) {
        next();
    } else {
        next(new Error(JSON.stringify({
            code: 3002,
        })));
    }
});

io.on('connection', socket => {
    const cid = clients.length;
    clients.push({
        socket: socket,
        priority: 0,
    });

    socket.on('set-priority', value => {
        clients[cid].priority = value;
    });

    socket.on('disconnect', value => {
        clients[cid].priority = value;
    });
});

function check_source(req, res) {
    const data = req.body;
    if (config.allow_local_only && req.ip.match(/\d+\.\d+\.\d+\.\d+/)[0] != '127.0.0.1') {
        res.status(403).json({
            code: 3003,
        }).end();
        return true;
    }

    if (config.password && data.password != config.password) {
        res.status(403).json({
            code: 3001,
        }).end();
        return true;
    }

    return false;
}

app.use(express.json());

app.post('/api/task', (req, res) => {
    if (check_source(req, res)) { return; }

    const data = req.body;
    if (clients.length == 0) {
        res.status(500).json({
            code: 2001,
            details: 'No judger connected.',
        }).end();
        return;
    }

    const target = clients.reduce((acc, cur) => acc + cur) * Math.random();
    let sum = 0;
    for (let i of index_list) {
        sum += clients[i].priority;
        if (sum >= target) {
            clients[i].socket.emit('assign-task', data.task_id);
            break;
        }
    }

    res.json({
        code: 1000,
    }).end();
});

app.post('/api/token', (req, res) => {
    if (check_source(req, res)) { return; }

    const data = req.body;
    if (typeof(data.token) == 'string') {
        verified_tokens.push(data.token);
        res.json({
            code: 1000,
        }).end();
        return;
    }

    res.status(400).json({
        code: 4004,
    }).end();
});

server.listen(config.port, () => {
    console.log(`Server started on port ${config.port}.`);
});
