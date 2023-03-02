const { create_poker, get_cards_value, get_card_name, get_card_rank, SPECIAL_CARDS, OutState } = require("./card.js")
const { Player } = require("./player")
const { shuffle } = require("../utils")

const NUM_POKERS = 2
const NUM_PLAYERS = 4

class ValueCalculator {
    constructor(init_cards) {
        this.value = 0;
        this.all_value_cards = []
        this.normal_value_cards = [];

        const special_cards = [];
        for (const card of init_cards) {
            if (SPECIAL_CARDS.has(card)) {
                special_cards.push(card);
            }
        }

        if ((special_cards.length == 2) && (special_cards[0] == special_cards[1])) {
            this.value += 1;
            Array.prototype.push.apply(this.all_value_cards, special_cards)
        }
        else if (special_cards.length == 3) {
            Array.prototype.push.apply(this.all_value_cards, special_cards)
            this.value += 2
        }
    }

    update(raw_cards, cards_value) {
        if (cards_value > 0) {
            this.all_value_cards.push(raw_cards)
            this.value += cards_value;
            if (!SPECIAL_CARDS.has(get_card_name(raw_cards[0]))) {
                this.normal_value_cards.push(raw_cards);
            }
        }
    }

    calc() {
        // TODO: 连炸2222 3333算吗？
        const sorted_value_cards = this.normal_value_cards.sort((a, b) => get_card_rank(a[0]) - get_card_rank(b[0]));
        for (let i = 1; i < sorted_value_cards.length; i++) {
            if (get_card_rank(sorted_value_cards[i - 1][0]) === get_card_rank(sorted_value_cards[i][0]) - 1) {
                this.value += 1;
            }
        }
        return this.value
    }
}


class Game {
    constructor() {
        this.pokers = create_poker(NUM_POKERS)
        this.all_players = []
        this.num_rounds = 0
        this.global_players_score = Array(NUM_PLAYERS).fill(0)  // 全局得分
        this.init(null)
    }

    init(last_winner) {
        this.players_score = Array(NUM_PLAYERS).fill(0)   // 当前局得分
        this.winners_order = []
        this.first_player_id = -1

        this.num_rounds += 1

        // 发牌
        this.deal(last_winner)

        this.player_value_calculator = Array(NUM_PLAYERS).fill().map((_, i) => new ValueCalculator(this.all_players[i].cards));

        this.last_valid_player_id = this.first_player_id
        this.last_valid_cards_info = null
        this.is_start = true
        this.continue_pass_cnts = 0
    }

    get_first_player(last_winner) {
        if (last_winner === null) {
            this.first_player_id = Math.floor(Math.random() * NUM_PLAYERS);
        } else {
            this.first_player_id = last_winner;
        }
    }

    random_split_cards() {
        // this.pokers = shuffle(this.pokers)
        const batch_size = this.pokers.length / NUM_PLAYERS
        for (let i = 0; i < NUM_PLAYERS; i++) {
            this.all_players.push(
                new Player(this.pokers.slice(i * batch_size, (i + 1) * batch_size), false)
            )
        }
    }

    get_friend_info() {
        this.friend_card = this.all_players[this.first_player_id].select_friend_card()
        this.friend_map = {}

        let other_id1 = null
        let other_id2 = null
        for (let i = 0; i < NUM_PLAYERS; i++) {
            if (i == this.first_player_id) {
                continue
            }
            else if (this.all_players[i].contain_friend_card(this.friend_card)) {
                this.friend_map[i] = this.first_player_id
                this.friend_map[this.first_player_id] = i
            }
            else{
                if (other_id1 === null) {
                    other_id1 = i
                }
                else{
                    other_id2 = i
                }
            }
        }
        this.friend_map[other_id1] = other_id2
        this.friend_map[other_id2] = other_id1
    }

    deal(last_winner = null) {
        //获取首位出牌玩家
        this.get_first_player(last_winner)

        // 发牌
        this.random_split_cards()

        // 获取朋友配对信息
        this.get_friend_info()
    }

    get_score_without_value() {
        // 判断是每个用户的输赢
        // 比如[1, -1, 1, -1]表示关单，[2, -2, 2, -2]表示关双，[0, 0, 0, 0]表示平局
        let first_winner = this.winners_order[0]
        let score = Array(NUM_PLAYERS).fill(0)
        let friend_id = this.friend_map[first_winner]
        let friend_order = this.winners_order.indexOf(friend_id)
        // 关双
        if (friend_order == 1) {
            score[first_winner] = 2
            score[friend_id] = 2
        }
        // 关单
        else if (friend_order == 2) {
            score[first_winner] = 1
            score[friend_id] = 1
        }
        // 平局
        else {
            score[first_winner] = 0
            score[friend_id] = 0
        }

        for (let i = 0; i < NUM_PLAYERS; i++) {
            if (score[i] !== score[first_winner]) {
                score[i] = -score[first_winner]
            }
        }
        return score
    }

    get_final_value() {
        // players_value是赏，normal_score涉及关双还是关单
        let players_value = Array(NUM_PLAYERS).fill(0)
        let total_value = 0
        for (let i = 0; i < NUM_PLAYERS; i++) {
            let value = this.player_value_calculator[i].calc()
            total_value += value
            players_value.push(value)
        }

        let normal_score = this.get_score_without_value()
        for (let i = 0; i < NUM_PLAYERS; i++) {
            this.players_score[i] = players_value[i] * (NUM_PLAYERS - 1) - (total_value - players_value[i]) + normal_score[i]
            this.global_players_score[i] += this.players_score[i]
        }
        return {players_value, normal_score}
    }

    is_over(){
        if (this.winners_order.length == NUM_PLAYERS - 1) {
            return true
        }
        else if (this.winners_order.length == 2) {
            return this.winners_order.includes(this.friend_map[this.winners_order[0]])
        }
        return false
    }

    step(curr_player_id, raw_cards, cards_info, cards_value, all_cards, out_state) {
        let show_value_cards = null
        let rank = null
        if (out_state === OutState.VALID) {
            this.all_players[curr_player_id].cards = all_cards
            this.last_valid_cards_info = cards_info
            this.last_valid_player_id = curr_player_id
            this.player_value_calculator[curr_player_id].update(raw_cards, cards_value)

            this.continue_pass_cnts = 0

            if (all_cards.length === 0) {
                // 当前玩家没有手牌了
                this.winners_order.push(curr_player_id)
                rank = this.winners_order.length
            }
            if (cards_value > 0) {
                // 有赏，就全部返回，包括王
                show_value_cards = raw_cards
            }
            else if (raw_cards.some(card => SPECIAL_CARDS.has(card))) {
                // 无赏，就只返回王
                show_value_cards = raw_cards.filter(card => SPECIAL_CARDS.has(card))
            }
        }
        else if (out_state === OutState.PASS) {
            this.continue_pass_cnts += 1
        }

        if (this.is_over()) {
            for(let i = 0; i < NUM_PLAYERS; i++) {
                if (!this.winners_order.includes(i)){
                    this.winners_order.push(i)
                }
            }
            let {players_value, normal_score} = this.get_final_value()
            return {
                status: 0,
                msg: "游戏结束",
                players_value: players_value,
                normal_score: normal_score
            }
        }
        else {
            let next_player_id = (curr_player_id + 1) % NUM_PLAYERS
            while (this.all_players[next_player_id].cards.length == 0) {
                this.continue_pass_cnts += 1
                next_player_id = (next_player_id + 1) % NUM_PLAYERS
            }
            /* TODO: 当上家出完手牌后的逻辑有点不懂
                上家出完后，有两种情况：1. 朋友牌未出 2. 朋友牌已出
                如果情况为1那么正常出牌（但是周期变为3了），3轮还是没有人出牌，则重置，所以is_start不是用id相等，而是用连续pass的次数除以周期
                如果为情况2，那么必须别人要不起的时候，才能保朋友?
                还有一个问题：是对方的朋友牌出了才可以，没有朋友牌的一对可以互保吗？
            */
            if(this.continue_pass_cnts >= NUM_PLAYERS - 1){
                this.is_start = true
                this.continue_pass_cnts = 0
            }
            else{
                this.is_start = false
            }
            const is_friend = (out_state == OutState.NO_CARDS) && (this.friend_map[next_player_id] === this.game_state.last_valid_player_id)
            // 如果回合结束还是自己 或者 朋友牌已出，当一方出完且下个用户是朋友时重置
            this.is_start = this.is_start || is_friend

            if (this.is_start) {
                this.last_valid_cards_info = null
                this.last_valid_player_id = null
            }

            return {
                status: 1,
                msg: "游戏进行中",
                next_player_id: next_player_id,
                value_cards: show_value_cards,
                rank: rank
            }
        }
    }

}

module.exports = {
    Game
}