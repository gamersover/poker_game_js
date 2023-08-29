import room_data from '../data/room_data.js'
import utils from '../utils.js'
import { PlayerState, GameState } from '../card_game/game.js'


function create_room(room_number, player_name, player_avatar, socket_id) {
    if (room_number === null) {
        room_number = utils.geneRoomNumber()
        let random_cnt = 0
        while (room_data[room_number]){
            room_number = utils.geneRoomNumber()
            if (++random_cnt > 100) {
                return {
                    status: 0,
                    msg: "创建失败，房间爆满，请稍后重试。"
                }
            }
        }
        let player_id = 0
        room_data[room_number] = {
            room_host_id: player_id,
            players_info: {},
            prepared_cnt: 0,
            all_players_name: [player_name],
            state: GameState.GameNotStart
        }

        room_data[room_number].players_info[player_id] = {
            state: PlayerState.InGame,
            player_name: player_name,
            player_avatar: player_avatar,
            socket_id: socket_id,
        }
        return {
            status: 1,
            msg: `创建房间成功`,
            game_info: {
                room_number: room_number,
                host_id: room_data[room_number].room_host_id,
                state: room_data[room_number].state
            },
            player_id: player_id,
            players_info: room_data[room_number].players_info
        }
    }
    else{
        return {status: 0, "msg": "已经创建成功，无法重新创建"}
    }
}

function handle_join_room(player_name, player_avatar, player_id, socket_id, all_players_name, players_info, room_number){
    // TODO: join_room和join_room_second可以写成一个函数吗
    // let n = 1
    // let new_player_name = player_name
    // while (all_players_name.includes(new_player_name)){
    //     new_player_name = player_name + n
    //     n++
    // }

    if (player_id == null) {
        player_id = 0
        for (; player_id < 4; player_id++){
            if (!players_info[player_id]){
                players_info[player_id] = {
                    state: PlayerState.InGame,
                    player_name: player_name,
                    player_avatar: player_avatar,
                    socket_id: socket_id,
                }
                all_players_name.push(player_name)
                break
            }
        }
    }
    else {
        all_players_name.splice(all_players_name.indexOf(players_info[player_id].player_name), 1)
        all_players_name.push(player_name)
        room_data[room_number].players_info[player_id] = {
            ...players_info[player_id],
            player_name: player_name,
            player_avatar: player_avatar,
            socket_id: socket_id,
        }
    }
    return {player_name, player_id}
}


function join_room(room_number, player_name, player_avatar, socket_id){
    if (!room_data[room_number]) {
        return {
            status: 0,
            msg: "房间未创建，无法加入",
            game_info: {
                room_number: room_number
            }
        }
    }

    const all_players_name = room_data[room_number].all_players_name
    const players_info = room_data[room_number].players_info
    if (all_players_name.length == 4) {
        // 找到退出的所有用户
        let exited_players_id = []
        let exited_players_info = {}
        for (let player_id in players_info) {
            if (players_info[player_id].is_exited == 1) {
                exited_players_id.push(player_id)
                exited_players_info[player_id] = {
                    player_name: players_info[player_id].player_name,
                    player_avatar: players_info[player_id].player_avatar,
                }
            }
        }

        if (exited_players_id.length == 0) {
            return {
                status: 0,
                msg: "该房间已满，无法进入！",
                game_info: {
                    room_number: room_number
                }
            }
        }
        else {
            return {
                status: 2,
                msg: "请选择要替换的用户",
                exited_players_id: exited_players_id,
                exited_players_info: exited_players_info
            }
        }
    }

    const {player_id: new_player_id, new_player_name: new_player_name} = handle_join_room(player_name, player_avatar, null, socket_id, all_players_name, players_info, room_number)

    return {
        status: 1,
        msg: `玩家${new_player_name}进入房间${room_number}`,
        game_info: {
            room_number: room_number,
            host_id: room_data[room_number].room_host_id,
            state: room_data[room_number].state,
            messages: room_data[room_number].messages || []
        },
        player_id: new_player_id,
        players_info: players_info
    }
}

function join_room_second(room_number, player_id, player_name, player_avatar, socket_id){
    if (!room_data[room_number]) {
        return {
            status: 0,
            msg: "房间已解散，无法加入",
            game_info: {
                room_number: room_number
            }
        }
    }
    else if (room_data[room_number].players_info[player_id].is_exited != 1) {
        return {
            status: 0,
            msg: "该用户已被承接，无法加入",
            game_info: {
                room_number: room_number,
                player_id: player_id
            }
        }
    }
    else {
        const all_players_name = room_data[room_number].all_players_name
        const players_info = room_data[room_number].players_info
        const {player_id: new_player_id, new_player_name: new_player_name}  = handle_join_room(player_name, player_avatar, player_id, socket_id, all_players_name, players_info, room_number)
        const game = room_data[room_number].game

        players_info[new_player_id].is_exited = 0

        let game_state = GameState.GameStart
        for (let player_id in players_info) {
            if (players_info[player_id].is_exited == 1) {
                game_state = GameState.GameStop
                break
            }
        }

        room_data[room_number].state = game_state

        return {
            status: 1,
            msg: `玩家${new_player_name}进入房间${room_number}`,
            game_info: {
                room_number: room_number,
                host_id: room_data[room_number].room_host_id,
                state: room_data[room_number].state,
                curr_player_id: game.curr_player_id,
                friend_card: game.friend_card,
                friend_card_cnt: game.friend_card_cnt,
                is_start: game.is_start,
                num_games: game.num_games,
                winners_order: game.winners_order,
                messages: room_data[room_number].messages || []
            },
            player_id: new_player_id,
            all_cards: game.all_players[new_player_id].cards,
            players_info: players_info,
            last_valid_cards_info: game.last_valid_cards_info,
        }
    }
}

function prepare_start(room_number, player_name, player_id) {
    if (!room_data[room_number]){
        return {
            status: 0,
            msg: `房间${room_number}不存在`
        }
    }
    else if (!room_data[room_number].all_players_name.includes(player_name)){
        return {
            status: 0,
            msg: `用户${player_name}不在房间${room_number}内`
        }
    }
    else if (room_data[room_number].players_info[player_id].state == PlayerState.Prepared){
        return {
            status: 0,
            msg: `用户${player_name}已在房间${room_number}准备`
        }
    }
    else {
        room_data[room_number].players_info[player_id].state = PlayerState.Prepared
        let prepared_cnt = 0
        for (let player_id in room_data[room_number].players_info) {
            if (room_data[room_number].players_info[player_id].state >= PlayerState.Prepared
                && room_data[room_number].players_info[player_id].state < PlayerState.GameEnd) {
                prepared_cnt += 1
            }
        }
        room_data[room_number].prepared_cnt = prepared_cnt

        return {
            status: 1,
            player_id: player_id,
            players_info: room_data[room_number].players_info
        }
    }
}

export {
    create_room,
    join_room,
    join_room_second,
    prepare_start
}