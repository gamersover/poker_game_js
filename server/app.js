const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const room_handler = require('./handler/room_handler')
const game_handler = require('./handler/game_handler')
const room_data = require('./data/room_data')
const {OutState} = require('./card_game/card')

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    transports: ["websocket"]
})


server.listen(3000, () => {
    console.log('listening on *:3000');
});

io.on('connection', (socket) => {
    console.log("新用户连接")

    socket.on("create_room", (data) => {
        let result = room_handler.create_room(data.room_number, data.user_name, socket.id)
        if (result.status == 1) {
            console.log(`用户${result.player_name}创建房间${result.room_number}成功`)
        }
        else {
            console.log(`用户${data.user_name}创建房间${data.room_number}失败`)
        }
        socket.emit("create_room", result)
    })

    socket.on("join_room", (data) => {
        let result = room_handler.join_room(data.room_number, data.user_name, socket.id)
        if (result.status == 1) {
            console.log(`${result.player_name}加入房间${result.room_number}成功`)
            socket.emit("join_room", result)
            socket.broadcast.emit("join_room_others", result)
        }
        else {
            console.log(`${data.user_name}加入房间${data.room_number}失败`)
            socket.emit("join_room", result)
        }
    })

    socket.on("prepare_start", (data) => {
        let result = room_handler.prepare_start(data.room_number, data.user_name, data.user_id)
        if (result.status == 1) {
            console.log(`用户${result.player_name}已准备`)
            io.sockets.emit("prepare_start", result)

            if (room_data[data.room_number].prepared_cnt == 4) {
                let game_data = game_handler.init_game(data.room_number)
                if (game_data.status == 1) {
                    // 给首个出牌用户发送，上一次游戏状态
                    io.to(room_data[data.room_number].players_info[game_data.first_player_id].socket_id)
                        .emit("game_step", {
                            last_valid_cards_info: game_data.game_state.last_valid_cards_info,
                            is_start: game_data.game_state.is_start,
                        })

                    // 遍历玩家，并发送每个人的手牌信息
                    for (let i in room_data[data.room_number].players_info) {
                        io.to(room_data[data.room_number].players_info[i].socket_id)
                            .emit("game_start", {
                                all_cards: game_data.all_players[i].cards,
                                friend_card: game_data.friend_card,
                                first_player_name: game_data.first_player_name,
                                curr_player_name: game_data.first_player_name,
                                curr_player_id: game_data.first_player_id
                            })
                    }
                    console.log(`当前出牌用户${game_data.first_player_name}`)
                }
            }
        }
        else {
            console.log(result.msg)
        }
    })

    socket.on("game_step", (data) => {
        // data.raw_out_cards
        let result = game_handler.game_step(
            data.room_number,
            data.curr_player_id,
            data.cards_info,
            data.all_cards,
            data.out_state
        )
        if (result.status === 1) {
            const curr_player_id = room_data[data.room_number].game.game_state.curr_player_id
            const curr_player_name = room_data[data.room_number].players_info[curr_player_id].player_name
            if (data.out_state === OutState.VALID) {
                io.sockets.emit("game_step_info", {
                    status: 1,
                    last_valid_cards: data.raw_out_cards,
                    curr_player_id: curr_player_id,
                    curr_player_name: curr_player_name
                })
            }
            else {
                io.sockets.emit("game_step_info", {
                    status: 2,
                    curr_player_id: curr_player_id,
                    curr_player_name: curr_player_name
                })
            }
            console.log(`当前出牌用户${curr_player_name}`)
            io.to(room_data[data.room_number].players_info[curr_player_id].socket_id).emit("game_step", {
                last_valid_cards_info: room_data[data.room_number].game.game_state.last_valid_cards_info,
                is_start: room_data[data.room_number].game.game_state.is_start
            })
        }
    })

});

