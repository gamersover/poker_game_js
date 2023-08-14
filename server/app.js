import express from 'express';
import { createServer } from 'http';
import { Server } from "socket.io";
import { create_room, join_room, join_room_second, prepare_start } from './handler/room_handler.js';
import { init_game, game_step } from './handler/game_handler.js';
import room_data from './data/room_data.js';
import { OutState } from './card_game/card.js';
import { logger } from './logger.js';
import { GameState, PlayerState } from './card_game/game.js';

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

io.on('connection', (socket) => {
    logger.info("新用户连接")

    socket.on("create_room", (data) => {
        let result = create_room(data.room_number, data.player_name, data.player_avatar, socket.id)
        if (result.status == 1) {
            socket.join(result.game_info.room_number)
            socket.player_id = result.player_id
            socket.player_name = result.players_info[socket.player_id].player_name
            socket.room_number = result.game_info.room_number
            logger.info(`房间${socket.room_number}：用户${socket.player_name}创建成功`)
        }
        else {
            logger.info(`房间${socket.room_number}：用户${socket.player_name}创建失败`)
        }
        socket.emit("create_room", result)
    })

    socket.on("join_room", (data) => {
        // console.log("join_room", socket.id)
        // let sum = 0
        // for(let i = 0; i<10000000000; i++) {
        //     sum += i
        // }
        // console.log(sum)
        let result = join_room(data.room_number, data.player_name, data.player_avatar, socket.id)
        socket.emit("join_room", result)
        if (result.status == 1) {
            socket.join(result.game_info.room_number)
            socket.player_id = result.player_id
            socket.player_name = result.players_info[socket.player_id].player_name
            socket.room_number = result.game_info.room_number
            logger.info(`房间${socket.room_number}：用户${socket.player_name}加入成功`)
            io.to(socket.room_number).emit("join_room_global", result)
        }
        else if (result.status == 2) {
            logger.info(`房间${data.room_number}：用户${data.player_name}尝试加入中。。。`)
        }
        else {
            logger.info(`房间${data.room_number}：用户${data.player_name}加入失败`)
        }
    })

    socket.on("join_room_second", (data) => {
        let result = join_room_second(data.room_number, data.player_id, data.player_name, data.player_avatar, socket.id)

        if (result.status == 1) {
            socket.join(result.game_info.room_number)
            socket.player_id = result.player_id
            socket.player_name = result.players_info[socket.player_id].player_name
            socket.room_number = result.game_info.room_number
            logger.info(`房间${socket.room_number}：用户${socket.player_name}加入成功`)

            io.to(socket.room_number).emit("player_reconnect_global", {
                players_info: result.players_info,
                game_info: {
                    state: result.game_info.state
                }
            })

            socket.emit("player_reconnect", {
                status: 1,
                game_info: {
                    host_id: result.game_info.host_id,
                    curr_player_id: result.game_info.curr_player_id,
                    state: result.game_info.state,
                    friend_card: result.game_info.friend_card,
                    friend_card_cnt: result.game_info.friend_card_cnt,
                    num_games: result.game_info.num_games,
                    room_number: result.game_info.room_number,
                    winners_order: result.game_info.winners_order
                },
                players_info: result.players_info,
                user_info: {
                    all_cards: result.all_cards,
                    player_id: result.player_id,
                }
            })

            if (result.curr_player_id == result.player_id) {
                socket.emit("game_step", {
                    last_valid_cards_info: result.last_valid_cards_info,
                    is_start: result.is_start
                })
            }
        }
        else {
            socket.emit("player_reconnect", result)
        }
    })

    socket.on("prepare_start", () => {
        let result = prepare_start(socket.room_number, socket.player_name, socket.player_id)
        // console.log("prepare", socket.id)
        // let sum = 0
        // for(let i = 0; i<10000000000; i++) {
        //     sum += i
        // }
        // console.log(sum)
        if (result.status == 1) {
            logger.info(`房间${socket.room_number}：用户${socket.player_name}已准备`)
            const this_room_data = room_data[socket.room_number]
            const players_info = this_room_data.players_info
            players_info[socket.player_id].num_rounds = 0
            for (let player_id in players_info) {
                if (players_info[player_id].state == PlayerState.InGame
                    || players_info[player_id].state == PlayerState.Prepared) {
                    io.to(players_info[player_id].socket_id).emit("prepare_start_global", result)
                }
            }
            if (this_room_data.prepared_cnt == 4) {
                let game_data = init_game(socket.room_number)
                if (game_data.status == 1) {
                    // 给首个出牌用户发送，上一次游戏状态
                    io.to(players_info[game_data.curr_player_id].socket_id)
                        .emit("game_step", {
                            last_valid_cards_info: game_data.last_valid_cards_info,
                            is_start: game_data.is_start,
                        })

                    for (let i in players_info) {
                        if (i == game_data.curr_player_id) {
                            players_info[i].state = PlayerState.RoundStart
                        }
                        else {
                            players_info[i].state = PlayerState.GameStart
                        }
                    }

                    // 遍历玩家，并发送每个人的手牌信息
                    this_room_data.state = GameState.GameStart
                    for (let i in this_room_data.players_info) {
                        io.to(this_room_data.players_info[i].socket_id)
                            .emit("game_start_global", {
                                user_info: {
                                    all_cards: game_data.all_players[i].cards,
                                },
                                game_info: {
                                    friend_card: game_data.friend_card,
                                    curr_player_id: game_data.curr_player_id,
                                    num_games: game_data.num_games,
                                    state: this_room_data.state
                                },
                                players_info: this_room_data.players_info
                            })
                    }
                    logger.info(`房间${socket.room_number}：当前出牌用户${players_info[game_data.curr_player_id].player_name}`)
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
        )
        let game = room_data[socket.room_number].game
        let players_info = room_data[socket.room_number].players_info
        if (result.status === 1) {
            const next_player_id = result.next_player_id
            let num_cards = game.all_players[socket.player_id].cards.length
            num_cards = num_cards > 5 ? null : num_cards

            players_info[next_player_id].state = PlayerState.RoundStart
            players_info[socket.player_id].num_cards = num_cards
            players_info[socket.player_id].num_rounds += 1

            const last_cards_value = players_info[next_player_id].curr_cards_value || 0
            players_info[next_player_id].total_cards_value += last_cards_value
            players_info[next_player_id].curr_cards_value = 0
            if (players_info[next_player_id].value_cards) {
                players_info[next_player_id].show_value_cards = [...players_info[next_player_id].value_cards]
            }
            else {
                players_info[next_player_id].show_value_cards = []
            }

            if (data.out_state === OutState.VALID) {
                // 游戏出牌状态发给所有用户
                players_info[socket.player_id].state = result.rank ? PlayerState.PlayerEnd : PlayerState.GameStart
                players_info[socket.player_id].valid_cards = data.raw_out_cards

                if (typeof(players_info[socket.player_id].total_cards_value) === 'undefined') {
                    players_info[socket.player_id].total_cards_value = 0
                }
                players_info[socket.player_id].curr_cards_value = result.cards_value

                if (!players_info[socket.player_id].value_cards) {
                    players_info[socket.player_id].value_cards = []
                }
                if (result.value_cards) {
                    players_info[socket.player_id].value_cards.push(result.value_cards)
                }
                players_info[socket.player_id].joker_cards = result.joker_cards
                players_info[socket.player_id].rank = result.rank

                io.to(socket.room_number).emit("game_step_global", {
                    status: 1,
                    game_info: {
                        curr_player_id: next_player_id,
                        friend_card_cnt: game.friend_card_cnt,
                        is_friend_help: result.is_friend_help
                    },
                    players_info: players_info
                })
            }
            else {
                // 游戏跳过状态发给所有用户
                players_info[socket.player_id].state = PlayerState.RoundSkip
                players_info[socket.player_id].valid_cards = []
                players_info[socket.player_id].cards_value = 0
                players_info[socket.player_id].rank = null
                io.to(socket.room_number).emit("game_step_global", {
                    status: 2,
                    game_info: {
                        curr_player_id: next_player_id,
                        friend_card_cnt: game.friend_card_cnt,
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
            console.log(game.winners_order)
            for (let i of game.winners_order) {
                players_info[i].value_score = result.value_scores[i]
                players_info[i].normal_score = result.normal_scores[i]
                players_info[i].final_score = game.players_score[i]
                players_info[i].global_score = game.global_players_score[i]
                players_info[i].state = PlayerState.GameEnd
                players_info[i].num_cards = game.all_players[i].cards.length
                players_info[i].valid_cards = game.all_players[i].cards
            }
            io.to(socket.room_number).emit("game_step_global", {
                status: 3,
                game_info: {
                    friend_card_cnt: game.friend_card_cnt,
                    winners_order: game.winners_order
                },
                players_info
            })
        }
    })

    socket.on("next_round", () => {
        let this_room_data = room_data[socket.room_number]
        let players_info = this_room_data.players_info
        const { player_name, socket_id, global_score, player_avatar } = players_info[socket.player_id]
        players_info[socket.player_id] = {
            state: PlayerState.InGame,
            player_name,
            socket_id,
            global_score,
            player_avatar
        }

        // 只给已经触发了next_round的玩家发送
        for (let player_id in players_info) {
            if (players_info[player_id].state == PlayerState.InGame
                || players_info[player_id].state == PlayerState.Prepared) {
                io.to(players_info[player_id].socket_id).emit("join_room_global", {
                    status: 1,
                    msg: `玩家${player_name}在房间${socket.room_number}准备下一轮`,
                    game_info: {
                        host_id: this_room_data.room_host_id,
                    },
                    player_id: socket.player_id,
                    players_info: players_info
                })
            }
        }
    })

    socket.on("disconnect", (data) => {
        // 如果游戏进行中，保留用户信息，等待用户重连
        if (socket.room_number && room_data[socket.room_number]) {
            let this_room_data = room_data[socket.room_number]
            logger.info(`房间${socket.room_number}的用户${socket.player_name}已退出`)
            let players_info = this_room_data.players_info

            socket.leave(socket.room_number)
            if (this_room_data.game) {
                // 游戏启动了
                players_info[socket.player_id].is_exited = 1
                this_room_data.state = GameState.GameStop
            }
            else {
                // 游戏未启动
                delete players_info[socket.player_id]
                this_room_data.all_players_name.splice(this_room_data.all_players_name.indexOf(socket.player_name), 1)
            }

            // 找出所有未退出的用户
            let all_not_exited_players = []
            for (let player_id in players_info) {
                if (players_info[player_id].is_exited != 1) {
                    all_not_exited_players.push(player_id)
                }
            }

            if (all_not_exited_players.length > 0) {
                io.to(socket.room_number).emit("player_exit", {
                    status: 1,
                    players_info: players_info,
                    game_info: {
                        state: this_room_data.state,
                        host_id: this_room_data.room_host_id
                    }
                })
            }
            else {
                delete room_data[socket.room_number]
            }
        }
    })

});

