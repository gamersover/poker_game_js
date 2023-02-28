const room_data = require('../data/room_data')
const {Game} = require('../card_game/game')


function init_game(room_number) {
    if(!room_number || !room_data[room_number]){
        return {status: 0, "msg": `不存在房间${room_number}信息`}
    }
    else if (room_data[room_number].all_players_name.length === 4) {
        if (!room_data[room_number].game) {
            room_data[room_number].game = new Game()
        }
        let game = room_data[room_number].game
        return {
            status: 1,
            msg: "开始游戏",
            all_players: game.all_players,
            friend_card: game.friend_card,
            first_player_id: game.first_player_id,
            first_player_name: room_data[room_number].players_info[game.first_player_id].player_name,
            game_state: game.game_state
        }
    }
    else{
        return {status: 0, msg: `等待玩家加入（${room_data[room_number].all_players_name.length} / 4）`}
    }
}

function game_step(room_number, curr_player_id, raw_cards, cards_info, cards_value, all_cards, out_state){
    const result = room_data[room_number].game.step(curr_player_id, raw_cards, cards_info, cards_value, all_cards, out_state)
    return result
}

exports.init_game = init_game
exports.game_step = game_step