const {io} = require("socket.io-client");

const socket = io("ws://localhost:3000", {
    transports: ["websocket"]
})

socket.emit("create_room", {room_number: null})


socket.on("create_room", (data) => {
    console.log(data)
})
