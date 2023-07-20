import room_data from '../data/room_data.js'
import utils from '../utils.js'
import { GameState } from '../card_game/game.js'


function create_room(room_number, player_name, socket_id) {
    if (room_number === null) {
        room_number = utils.geneRoomNumber()
        let random_cnt = 0
        while (room_data[room_number]){
            room_number = utils.geneRoomNumber()
            if (++random_cnt > 100) {
                return {
                    status: 0,
                    msg: "创建失败，房间已满"
                }
            }
        }
        let player_id = 0
        room_data[room_number] = {
            room_host_id: player_id,
            players_info: {},
            prepared_cnt: 0,
            all_players_name: [player_name]
        }

        room_data[room_number].players_info[player_id] = {
            state: GameState.InGame,
            player_name: player_name,
            socket_id: socket_id,
        }
        return {
            status: 1,
            msg: `创建房间成功`,
            room_info: {
                room_number: room_number,
                host_id: room_data[room_number].room_host_id,
            },
            player_id: player_id,
            players_info: room_data[room_number].players_info
        }
    }
    else{
        return {status: 0, "msg": "已经创建成功，无法重新创建"}
    }
}


function join_room(room_number, player_name, socket_id){
    if (!room_data[room_number]) {
        return {
            status: 0,
            msg: "房间未创建，无法加入",
            room_info: {
                room_number: room_number
            }
        }
    }
    if (room_data[room_number].all_players_name.length == 4) {
        return {
            status: 0,
            msg: "该房间已满，无法进入！",
            room_info: {
                room_number: room_number
            }
        }
    }

    let n = 1
    let new_player_name = player_name
    while (room_data[room_number].all_players_name.includes(new_player_name)){
        new_player_name = player_name + n
        n++
    }
    player_name = new_player_name

    let player_id = 1
    for (; player_id < 4; player_id++){
        if (!room_data[room_number].players_info[player_id]){
            room_data[room_number].players_info[player_id] = {
                state: GameState.InGame,
                player_name: player_name,
                socket_id: socket_id,
            }
            room_data[room_number].all_players_name.push(player_name)
            break
        }
    }

    return {
        status: 1,
        msg: `玩家${player_name}进入房间${room_number}`,
        room_info: {
            room_number: room_number,
            host_id: room_data[room_number].room_host_id,
        },
        player_id: player_id,
        players_info: room_data[room_number].players_info
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
    else if (room_data[room_number].players_info[player_id].state == GameState.Prepared){
        return {
            status: 0,
            msg: `用户${player_name}已在房间${room_number}准备`
        }
    }
    else {
        room_data[room_number].players_info[player_id].state = GameState.Prepared
        room_data[room_number].prepared_cnt += 1
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
    prepare_start
}