import express from 'express';
import { createServer } from 'http';
import { Server } from "socket.io";
import { create_room, join_room, prepare_start } from './handler/room_handler.js';
import { init_game, game_step } from './handler/game_handler.js';
import room_data from './data/room_data.js';
import { OutState } from './card_game/card.js';
import { logger } from './logger.js';
import { GameState } from './card_game/game.js';

const app = express();
const server = createServer(app);
const io = new Server(server, {
    transports: ["websocket"],
    cors: {
        origin: "*",
    }
})
const PORT = 3001

server.listen(PORT, () => {
    logger.info(`服务器启动，监听端口${PORT}`);
});

// TODO: 服务端emit的时候不应该只是发送一些杂数据，而应该处理后包装在一个players_info里面，不要扔到客户端再去计算出players_info
io.on('connection', (socket) => {
    logger.info("新用户连接")

    socket.on("create_room", (data) => {
        let result = create_room(data.room_number, data.player_name, socket.id)
        if (result.status == 1) {
            socket.join(result.room_info.room_number)
            socket.player_id = result.player_id
            socket.player_name = result.players_info[socket.player_id].player_name
            socket.room_number = result.room_info.room_number
            logger.info(`房间${socket.room_number}：用户${socket.player_name}创建成功`)
        }
        else {
            logger.info(`房间${socket.room_number}：用户${socket.player_name}创建失败`)
        }
        socket.emit("create_room", result)
    })

    socket.on("join_room", (data) => {
        let result = join_room(data.room_number, data.player_name, socket.id)
        if (result.status == 1) {
            socket.join(result.room_info.room_number)
            socket.player_id = result.player_id
            socket.player_name = result.players_info[socket.player_id].player_name
            socket.room_number = result.room_info.room_number
            logger.info(`房间${socket.room_number}：用户${socket.player_name}加入成功`)
            socket.emit("join_room", result)
            socket.to(result.room_info.room_number).emit("join_room_others", result)
        }
        else {
            logger.info(`房间${data.room_number}：用户${data.player_name}加入失败`)
            socket.emit("join_room", result)
        }
    })

    socket.on("prepare_start", () => {
        let result = prepare_start(socket.room_number, socket.player_name, socket.player_id)
        if (result.status == 1) {
            logger.info(`房间${socket.room_number}：用户${socket.player_name}已准备`)
            socket.emit("prepare_start", result)
            io.to(socket.room_number).emit("prepare_start_global", result)

            const this_room_data = room_data[socket.room_number]

            if (this_room_data.prepared_cnt == 4) {
                let game_data = init_game(socket.room_number)
                if (game_data.status == 1) {
                    // 给首个出牌用户发送，上一次游戏状态
                    io.to(this_room_data.players_info[game_data.first_player_id].socket_id)
                        .emit("game_step", {
                            last_valid_cards_info: game_data.last_valid_cards_info,
                            is_start: game_data.is_start,
                        })

                    for(let i in this_room_data.players_info) {
                        if (i == game_data.first_player_id) {
                            this_room_data.players_info[i].state = GameState.RoundStart
                        }
                        else {
                            this_room_data.players_info[i].state = GameState.GameStart
                        }
                    }

                    // 遍历玩家，并发送每个人的手牌信息
                    for (let i in this_room_data.players_info) {
                        io.to(this_room_data.players_info[i].socket_id)
                            .emit("game_start_global", {
                                user_info: {
                                    all_cards: game_data.all_players[i].cards,
                                },
                                game_info: {
                                    friend_card: game_data.friend_card,
                                    first_player_id: game_data.first_player_id,
                                    num_rounds: game_data.num_rounds
                                },
                                players_info: this_room_data.players_info
                            })
                    }
                    logger.info(`房间${socket.room_number}：当前出牌用户${game_data.first_player_name}`)
                }
            }
        }
        else {
            socket.emit("prepare_failed", result)
        }
    })

    socket.on("game_step", (data) => {
        let result = game_step(
            socket.room_number,
            socket.player_id,
            data.raw_cards,
            data.cards_info,
            data.cards_value,
            data.all_cards,
            data.out_state,
            data.has_friend_card
        )
        let game = room_data[socket.room_number].game
        let players_info = room_data[socket.room_number].players_info
        if (result.status === 1) {
            const next_player_id = result.next_player_id
            let num_cards = game.all_players[socket.player_id].cards.length
            num_cards = num_cards > 5 ? null : num_cards

            players_info[next_player_id].state = GameState.RoundStart
            players_info[socket.player_id].num_cards = num_cards
            players_info[socket.player_id].value_scores = result.value_scores

            if (data.out_state === OutState.VALID) {
                // 游戏出牌状态发给所有用户
                players_info[socket.player_id].state = GameState.GameStart
                players_info[socket.player_id].valid_cards = data.raw_out_cards
                players_info[socket.player_id].cards_value = result.cards_value
                players_info[socket.player_id].value_cards = result.value_cards || null
                if (!players_info[socket.player_id].all_joker_cards) {
                    players_info[socket.player_id].all_joker_cards = []
                }
                if (result.joker_cards) {
                    players_info[socket.player_id].all_joker_cards = [
                        ...players_info[socket.player_id].all_joker_cards,
                        ...result.joker_cards
                    ]
                }
                players_info[socket.player_id].rank = result.rank
                io.to(socket.room_number).emit("game_step_global", {
                    status: 1,
                    game_info: {
                        curr_player_id: next_player_id,
                        has_friend_card: data.has_friend_card,
                        is_friend_help: result.is_friend_help
                    },
                    players_info: players_info
                })
            }
            else {
                // 游戏跳过状态发给所有用户
                players_info[socket.player_id].state = GameState.RoundSkip
                players_info[socket.player_id].valid_cards = []
                players_info[socket.player_id].cards_value = 0
                players_info[socket.player_id].rank = null
                io.to(socket.room_number).emit("game_step_global", {
                    status: 2,
                    game_info: {
                        curr_player_id: next_player_id,
                    },
                    players_info: players_info
                })
            }
            const next_player = players_info[next_player_id]
            logger.info(`房间${socket.room_number}： 当前出牌用户${next_player.player_name}`)
            io.to(next_player.socket_id).emit("game_step", {
                last_valid_cards_info: game.last_valid_cards_info,
                is_start: game.is_start,
            })
        }
        else if (result.status == 0) {
            let game_result = []
            for (let i of game.winners_order) {
                game_result.push({
                    player_id: i,
                    player_name: room_data[socket.room_number].players_info[i].player_name,
                    // winners_order: winners_order,
                    value_score: result.value_scores[i],   // 讨赏值
                    normal_score: result.normal_scores[i], // 关双关单
                    final_score: game.players_score[i], // 最终得分
                    global_score: game.global_players_score[i]  // 多局游戏总得分
                })
            }

            io.to(socket.room_number).emit("game_over_global", {
                status: 1,
                last_valid_cards: data.raw_out_cards,
                last_player_id: socket.player_id,
                last_player_num_cards: 0,
                value_cards: result.value_cards || null,
                cards_value: result.cards_value,
                has_friend_card: data.has_friend_card,
                rank: result.rank,
                // winners_order: winners_order,
                game_result: game_result
            })
        }
    })

    socket.on("disconnect", (data) => {
        if (socket.room_number && room_data[socket.room_number]) {
            if (socket.player_id == room_data[socket.room_number].room_host_id) {
                // TODO: 房主退出，应该通知其他人并退出房间，还是说再选一个房主？
                logger.info(`房间${socket.room_number}的房主已退出`)
                delete room_data[socket.room_number]
            }
            else {
                // TODO: 其他用户退出，需要emit给剩余用户
                logger.info(`房间${socket.room_number}的用户${socket.player_name}已退出`)
                delete room_data[socket.room_number].players_info[socket.player_id]
                room_data[socket.room_number].all_players_name.splice(room_data[socket.room_number].all_players_name.indexOf(socket.player_name), 1)
            }
        }
    })

});

