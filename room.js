const room_data = require('./data/room_data')
const utils = require('./utils.js')


function create_room(room_number) {
    if (!room_number) {
        room_number = utils.geneRoomNumber()
        while (room_data[room_number]){
            room_number = utils.geneRoomNumber()
        }
        room_data[room_number] = {
            num_players: 1,     // 玩家数
            players_info: {}    // 玩家信息
        }
        let player_name = `p${room_data[room_number].num_players}`
        room_data[room_number].players_info["room_host"] = player_name
        room_data[room_number].players_info["players_list"] = [player_name]
        return {
            state: 1,
            msg: `创建房间成功`,
            room_number: room_number,
            player_name: player_name,
            player_idx: room_data[room_number].num_players,
            players_info: room_data[room_number].players_info
        }
    }
    else{
        return {state: 0, "msg": "已经创建成功，无法重新创建"}
    }
}


function join_room(room_number){
    if (!room_data[room_number]) {
        return {state: 0, msg: "房间未创建，无法加入"}
    }
    if (room_data[room_number].num_players == 4) {
        room_data[room_number].is_full = true;
        return {state: 0, msg: "该房间已满，无法进入！"}
    }
    room_data[room_number].num_players += 1
    player_name = `p${room_data[room_number].num_players}`
    room_data[room_number].players_info.players_list.push(player_name)
    return {
        state: 1,
        msg: `加入房间${room_number}成功`,
        player_name: player_name,
        player_idx: room_data[room_number].num_players,
        players_info: room_data[room_number].players_info
    }
}

exports.create_room = create_room
exports.join_room = join_room