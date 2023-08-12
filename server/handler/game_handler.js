import room_data from '../data/room_data.js'
import Game from '../card_game/game.js'


function init_game(room_number) {
    if(!room_number || !room_data[room_number]){
        return {status: 0, "msg": `不存在房间${room_number}信息`}
    }
    else if (room_data[room_number].all_players_name.length === 4) {
        if (!room_data[room_number].game) {
            room_data[room_number].game = new Game()
        }
        let game = room_data[room_number].game
        game.init(null)
        return {
            status: 1,
            msg: "开始游戏",
            all_players: game.all_players,
            friend_card: game.friend_card,
            curr_player_id: game.curr_player_id,
            is_start: game.is_start,
            num_games: game.num_games
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

export {
    init_game,
    game_step
}