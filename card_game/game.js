const {create_poker, get_cards_value, get_card_name, get_card_rank, SPECIAL_CARDS} = require("./card.js")
const { Player, OutState} = require("./player")
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

    init(last_winner) {
        this.state_history = []
        this.player_value = Array(NUM_PLAYERS).fill(0)
        this.winners_order = []
        // 是否为首次出牌
        this.is_start = true

        this.num_rounds += 1
        console.log(`游戏开始，当前游玩次数：${this.num_rounds}`)

        // 发牌
        this.deal(last_winner)

        this.player_value_calculator = Array(NUM_PLAYERS).fill().map((_, i) => new ValueCalculator(this.all_players[i].cards));
    }

    get_first_player(last_winner) {
        this.first_player = -1;
        if (!last_winner) {
            this.first_player = Math.floor(Math.random() * NUM_PLAYERS);
        } else {
            this.first_player = last_winner;
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
        this.friend_card = this.all_players[this.first_player].select_friend_card()
        this.friend_map = {}
        this.friend_map[this.first_player] = 1
        for (let i = 0; i < NUM_PLAYERS; i++){
            if (i != this.first_player && this.all_players[i].contain_friend_card(this.friend_card)){
                this.friend_map[i] = 1
            }
            else if (i != this.first_player) {
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
}

module.exports = {
    Game,
    ValueCalculator
}