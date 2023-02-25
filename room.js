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
            player_idx: room_data[room_number].num_players
        }
    }
    else{
        return {state: 0, "msg": "已经创建成功，无法重新创建"}
    }
}

exports.create_room = create_room