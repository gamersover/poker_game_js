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

// TODO io.sockets这种群发，应该只限制这个room_number的

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
            io.sockets.emit("prepare_start_global", result)

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
                            .emit("game_start_global", {
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
            data.raw_cards,
            data.cards_info,
            data.cards_value,
            data.all_cards,
            data.out_state
        )
        let game = room_data[data.room_number].game
        if (result.status === 1) {
            const curr_player_id = game.game_state.curr_player_id
            const curr_player_name = room_data[data.room_number].players_info[curr_player_id].player_name
            if (data.out_state === OutState.VALID) {
                // 游戏出牌状态发给所有用户
                // TODO: 如果手牌少于6张，也要广播所有用户
                io.sockets.emit("game_step_global", {
                    status: 1,
                    last_valid_cards: data.raw_out_cards,
                    last_player_id: data.curr_player_id,
                    curr_player_id: curr_player_id,
                    curr_player_name: curr_player_name,
                    value_cards: result.value_cards || null
                })
            }
            else {
                // 游戏跳过状态发给所有用户
                io.sockets.emit("game_step_global", {
                    status: 2,
                    last_player_id: data.curr_player_id,
                    curr_player_id: curr_player_id,
                    curr_player_name: curr_player_name
                })
            }
            console.log(`当前出牌用户${curr_player_name}`)
            io.to(room_data[data.room_number].players_info[curr_player_id].socket_id).emit("game_step", {
                last_valid_cards_info: game.game_state.last_valid_cards_info,
                is_start: game.game_state.is_start
            })
        }
        else if (result.status == 0) {
            // TODO: id映射为user_name
            let winner_order = []
            game.winner_order.forEach((id) => {
                winner_order.push(room_data[data.room_number].players_info[id].player_name)
            })
            let game_result = []
            for(let i = 0; i < game.winner_order.length; i++) {
                game_result.push({
                    value: result.players_value[i],   // 讨赏值
                    normal_score: result.normal_score[i], // 关双关单
                    final_score: game.players_score[i], // 最终得分
                    global_score: game.global_players_score[i]  // 多局游戏总得分
                })
            }

            io.sockets.emit("game_over_global", {
                status : 1,
                winner_order: game.winner_order,
                game_result: game_result
            })
        }
    })

});

