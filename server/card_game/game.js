const {create_poker, get_cards_value, get_card_name, get_card_rank, SPECIAL_CARDS, OutState} = require("./card.js")
const { Player } = require("./player")
const {shuffle} = require("../utils")

const NUM_POKERS = 2
const NUM_PLAYERS = 4

class ValueCalculator {
    constructor(init_cards) {
        this.value = 0;
        this.all_value_cards = [];

        const special_cards_cnt = {};
        for (const card of init_cards) {
            if (SPECIAL_CARDS.has(card)) {
                special_cards_cnt[card] = (special_cards_cnt[card] || 0) + 1;
            }
        }

        const special_cards_cnt_values = Object.values(special_cards_cnt);
        if (special_cards_cnt_values.reduce((a, b) => a + b, 0) < 4 && special_cards_cnt_values.includes(2)) {
            this.value += 1;
        }
    }

    update(raw_cards) {
        const value = get_cards_value(raw_cards);
        if (value > 0 && !SPECIAL_CARDS.has(get_card_name(raw_cards[0]))) {
            this.all_value_cards.push(raw_cards);
        }
        this.value += value;
    }

    calc() {
        // TODO: 连炸2222 3333算吗？
        const sorted_value_cards = this.all_value_cards.sort((a, b) => get_card_rank(a[0]) - get_card_rank(b[0]));
        for (let i = 1; i < sorted_value_cards.length; i++) {
            if (get_card_rank(sorted_value_cards[i - 1][0]) === get_card_rank(sorted_value_cards[i][0]) - 1) {
                this.value += 1;
            }
        }
    }
}


class Game{
    constructor(){
        this.pokers = create_poker(NUM_POKERS)
        this.all_players = []
        this.num_rounds = 0
        this.global_player_value = Array(NUM_PLAYERS).fill(0)
        this.init(null)
    }

    init_game_state(){
        this.game_state = {
            curr_player_id: this.first_player_id,
            last_valid_player_id: this.first_player_id,
            last_valid_cards_info: null,
            is_start: true        // 是否为首次出牌
        }
    }

    init(last_winner) {
        this.state_history = []
        this.player_value = Array(NUM_PLAYERS).fill(0)
        this.winners_order = []
        this.first_player_id = -1;

        this.num_rounds += 1
        console.log(`游戏开始，当前游玩次数：${this.num_rounds}`)

        // 发牌
        this.deal(last_winner)

        this.player_value_calculator = Array(NUM_PLAYERS).fill().map((_, i) => new ValueCalculator(this.all_players[i].cards));

        this.init_game_state()
    }

    get_first_player(last_winner) {
        if (!last_winner) {
            this.first_player_id = Math.floor(Math.random() * NUM_PLAYERS);
        } else {
            this.first_player_id = last_winner;
        }
    }

    random_split_cards(){
        this.pokers = shuffle(this.pokers)
        const batch_size = this.pokers.length / NUM_PLAYERS
        for (let i = 0; i<NUM_PLAYERS; i++){
            this.all_players.push(
                new Player(this.pokers.slice(i*batch_size, (i + 1)*batch_size), false)
            )
        }
    }

    get_friend_info() {
        this.friend_card = this.all_players[this.first_player_id].select_friend_card()
        this.friend_map = {}
        this.friend_map[this.first_player_id] = 1
        for (let i = 0; i < NUM_PLAYERS; i++){
            if (i != this.first_player_id && this.all_players[i].contain_friend_card(this.friend_card)){
                this.friend_map[i] = 1
            }
            else if (i != this.first_player_id) {
                this.friend_map[i] = 2
            }
        }
    }

    deal(last_winner=null) {
        //获取首位出牌玩家
        this.get_first_player(last_winner)

        // 发牌
        this.random_split_cards()

        // 获取朋友配对信息
        this.get_friend_info()
    }


    step(curr_player_id, cards_info, all_cards, out_state){
        if (out_state === OutState.VALID){
            this.all_players[curr_player_id].cards = all_cards
            this.game_state.last_valid_cards_info = cards_info
            this.game_state.last_valid_player_id = curr_player_id
        }
        else if (out_state == OutState.NO_CARDS) {
            this.winners_order.push(curr_player_id)
        }

        if (this.winners_order.length == NUM_PLAYERS - 1){
            return {
                status: 0,
                msg: "游戏结束",
                winners_order: this.winners_order
            }
        }
        else {
            let player_id = (this.game_state.curr_player_id + 1) % NUM_PLAYERS
            while (this.all_players[player_id].cards.length == 0) {
                player_id = (player_id + 1) % NUM_PLAYERS
            }
            this.game_state.curr_player_id = player_id
            this.game_state.is_start = (this.game_state.last_valid_player_id === player_id)
            const is_friend = (out_state == OutState.NO_CARDS) && (this.friend_map[player_id] === this.game_state.last_valid_player_id)
            // 如果回合结束还是自己 或者 朋友牌已出，当一方出完且下个用户是朋友时重置
            // TODO: 是对方的朋友牌出了才可以，没有朋友牌的一对可以互保吗？
            if (this.game_state.is_start || is_friend) {
                this.game_state.last_valid_cards_info = null
                this.game_state.last_valid_player_id = null
            }

            return {
                status: 1,
                msg: "游戏进行中"
            }
        }
    }

}

module.exports = {
    Game
}