const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const room = require('./room')

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    transports: ["websocket"]
})


app.get('/', (req, res) => {
    console.log("hello")
})

server.listen(3000, () => {
    console.log('listening on *:3000');
});

io.on('connection', (socket) => {
    console.log("新用户连接")

    socket.on("create_room", (data) => {
        let result = room.create_room(data.room_number)
        socket.emit("create_room", result)
    })

    socket.on("join_room", (data) => {
        let result = room.join_room(data.room_number)
        // 广播所有人，且得到当前room的玩家信息
        socket.emit("join_room", result)
    })

});

