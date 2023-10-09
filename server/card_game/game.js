import { create_poker, get_all_zhadan, get_cards_value, get_card_name, get_card_rank, SPECIAL_CARDS, OutState } from "./card.js"
import Player from "./player.js"
import utils from '../utils.js'
import examples from "./test_cards.js"

const PlayerState = {
    "OutGame": 0,
    "InGame": 1,
    "Prepared": 2,
    "GameStart": 3, // or RoundEnd
    "RoundStart": 4,
    "RoundSkip": 5,
    "PlayerEnd": 6,
    "GameEnd": 7,
    "GameExit": 8
}

const GameState = {
    "GameNotStart": 0,
    "GameStart": 1,
    "GameStop": 2,
    "GameEnd": 3
}

const NUM_POKERS = 2
const NUM_PLAYERS = 4


class ValueCalculator {
    constructor(init_cards) {
        this.value = 0
        this.normal_zhadans = []
        this.valued_jokers = []
        this.valued_jokers_value = 0

        const joker_cards = []
        for (const card of init_cards) {
            if (SPECIAL_CARDS.has(card)) {
                joker_cards.push(card)
            }
        }

        // 四个王不能拆，拆了就没有赏了
        if ((joker_cards.length == 2) && (joker_cards[0] == joker_cards[1])) {
            this.valued_jokers = joker_cards
            this.valued_jokers_value = 1
        }
        else if (joker_cards.length == 3) {
            this.valued_jokers = joker_cards
            this.valued_jokers_value = 2
        }
    }

    update(raw_cards, cards_value) {
        // raw_cards是包含joker的，cards_value是四个王或者纯炸弹的赏值
        // TODO: 四个王如果同时替换为一张牌，那怎么算？
        const normal_cards = raw_cards.filter(card => !SPECIAL_CARDS.has(card))
        if (cards_value > 0) {
            if (raw_cards.every(card => SPECIAL_CARDS.has(card))) {
                this.valued_jokers = raw_cards
                this.valued_jokers_value = cards_value
            }
            else {
                this.normal_zhadans.push({
                    cards: normal_cards,
                    value: cards_value
                })
           }
        }
        else if (normal_cards.length >= 4 && normal_cards.every(card => get_card_name(card) === get_card_name(normal_cards[0]))) {
            this.normal_zhadans.push({
                cards: normal_cards,
                value: cards_value
            })
        }
    }

    calc(cards) {
        /**
         * joker单独算赏值
         * 4个头以上的炸弹的个数超过3个开始才有赏值
         * 5个头以上的炸弹的个数超过2个就有赏值
         * 6个头以上的炸弹本身就有赏值
         * 连炸有赏值
         * ? 那 6个3,6个5,6个7，怎么算赏值？
         */
        const zhadans = get_all_zhadan(cards)
        for (let zhadan of zhadans) {
            this.update(zhadan, get_cards_value(zhadan))
        }

        this.value += this.valued_jokers_value
        this.real_value_cards = this.valued_jokers.length > 0 ? [this.valued_jokers] : []

        const sorted_value_cards = this.normal_zhadans.sort((a, b) => get_card_rank(a.cards[0]) - get_card_rank(b.cards[0]));

        const zhadan_has_value = Array(sorted_value_cards.length).fill(false)
        // 记录五张以上相同牌构成的炸弹
        const five_cnt_zhandans_index = []
        for (let i = 0; i < sorted_value_cards.length; i++) {
            let is_value_cards = false
            if (sorted_value_cards[i].length >= 5) {
                five_cnt_zhandans_index.push(i)
            }

            if (sorted_value_cards[i].value > 0) {
                is_value_cards = true
                this.value += sorted_value_cards[i].value
            }
            else if (i > 0 && i === sorted_value_cards.length - 1 && get_card_rank(sorted_value_cards[i-1].cards[0]) === get_card_rank(sorted_value_cards[i].cards[0]) - 1) {
                is_value_cards = true
            }

            if (i < sorted_value_cards.length - 1 && get_card_rank(sorted_value_cards[i].cards[0]) === get_card_rank(sorted_value_cards[i+1].cards[0]) - 1) {
                this.value += 1
                is_value_cards = true
            }

            if (is_value_cards) {
                zhadan_has_value[i] = true
            }
        }

        const normal_zhadan_cnts = sorted_value_cards.length
        if (normal_zhadan_cnts >= 3) {
            this.value += normal_zhadan_cnts - 2
            this.real_value_cards = sorted_value_cards.map(card => card.cards)
        }
        else {
            if (five_cnt_zhandans_index.length >= 2) {
                this.value += 1
                five_cnt_zhandans_index.forEach(index => {
                    zhadan_has_value[index] = true
                })
            }
            zhadan_has_value.forEach((v, i) => {
                if (v) {
                    this.real_value_cards.push(sorted_value_cards[i].cards)
                }
            })
        }
    }
}


class Game {
    constructor() {
        this.pokers = create_poker(NUM_POKERS)
        this.num_games = 0
        this.global_players_score = Array(NUM_PLAYERS).fill(0)  // 全局得分
    }

    init(last_winner) {
        this.all_players = []

        this.players_score = Array(NUM_PLAYERS).fill(0)   // 当前局得分
        this.winners_order = []
        this.curr_player_id = -1

        this.num_games += 1

        // 发牌
        this.deal(last_winner)

        this.player_value_calculator = Array(NUM_PLAYERS).fill().map((_, i) => new ValueCalculator(this.all_players[i].cards));

        this.last_valid_player_id = this.curr_player_id
        this.last_valid_cards_info = null
        this.is_start = true
        this.continue_pass_cnts = 0
        this.friend_card_cnt = 2
    }

    get_first_player(last_winner) {
        if (last_winner === null) {
            this.curr_player_id = Math.floor(Math.random() * NUM_PLAYERS);
        } else {
            this.curr_player_id = last_winner;
        }
    }

    random_split_cards() {
        this.pokers = utils.shuffle(this.pokers)
        const num_cards_per_player = this.pokers.length / NUM_PLAYERS
        for (let i = NUM_PLAYERS - 1; i >= 0; i--) {
            this.all_players.push(
                new Player(this.pokers.slice(i*num_cards_per_player, (i+1)*num_cards_per_player), false)
            )
        }

        // TODO: 测试方便，先不shuffle
        // for (let i = NUM_PLAYERS - 1; i >= 0; i--) {
        //     this.all_players.push(
        //         new Player(examples["first"][i], false)
        //     )
        // }
    }

    get_friend_info() {
        this.friend_card = this.all_players[this.curr_player_id].select_friend_card()
        this.friend_map = {}

        let other_id1 = null
        let other_id2 = null
        for (let i = 0; i < NUM_PLAYERS; i++) {
            if (i == this.curr_player_id) {
                continue
            }
            else if (this.all_players[i].contain_friend_card(this.friend_card)) {
                this.friend_map[i] = this.curr_player_id
                this.friend_map[this.curr_player_id] = i
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
        // value_scores是赏，normal_scores涉及关双还是关单
        let value_scores = Array(NUM_PLAYERS).fill(0)
        let total_value = 0
        const final_value_cards = {}
        for (let i = 0; i < NUM_PLAYERS; i++) {
            if (this.all_players[i].cards.length > 0) {
                this.player_value_calculator[i].calc(this.all_players[i].cards)
            }
            total_value += this.player_value_calculator[i].value
            value_scores[i] = this.player_value_calculator[i].value
            final_value_cards[i] = this.player_value_calculator[i].real_value_cards
        }

        let normal_scores = this.get_score_without_value()
        for (let i = 0; i < NUM_PLAYERS; i++) {
            this.players_score[i] = value_scores[i] * (NUM_PLAYERS - 1) - (total_value - value_scores[i]) + normal_scores[i]
            this.global_players_score[i] += this.players_score[i]
        }
        return {value_scores, normal_scores, final_value_cards}
    }

    is_over(){
        if (this.winners_order.length === 3) {
            return true
        }
        else if (this.winners_order.length == 2) {
            return this.winners_order[1] == this.friend_map[this.winners_order[0]]
        }
        return false
    }

    step(curr_player_id, raw_cards, cards_info, cards_value, all_cards, out_state) {
        let show_value_cards = null
        let send_friend_map = false
        let rank = null
        let final_value_cards = null
        if (out_state === OutState.VALID) {
            this.all_players[curr_player_id].cards = all_cards
            this.last_valid_cards_info = cards_info
            this.last_valid_player_id = curr_player_id
            this.player_value_calculator[curr_player_id].update(raw_cards, cards_value)

            const has_friend_card = raw_cards.some((card) => card == this.friend_card)

            if (has_friend_card) {
                this.friend_card_cnt -= 1
                if (this.friend_card_cnt === 0) {
                    send_friend_map = true
                }
            }

            this.continue_pass_cnts = 0

            if (all_cards.length === 0) {
                // 当前玩家没有手牌了
                this.winners_order.push(curr_player_id)
                this.player_value_calculator[curr_player_id].calc([])
                final_value_cards = this.player_value_calculator[curr_player_id].real_value_cards
                rank = this.winners_order.length
            }
            if (cards_value > 0) {
                // 有赏，就全部返回，包括王
                show_value_cards = raw_cards
            }
            else {
                // 无赏牌，但是有纯炸弹，也要show，考虑到连炸的情况
                const without_joker_cards = raw_cards.filter(card => !SPECIAL_CARDS.has(card))
                if (without_joker_cards.length >= 4 && without_joker_cards.every(card => get_card_name(card) == get_card_name(without_joker_cards[0]))) {
                    show_value_cards = raw_cards
                }
                else if (raw_cards.some(card => SPECIAL_CARDS.has(card))) {
                    // 无赏，就只返回王
                    show_value_cards = raw_cards.filter(card => SPECIAL_CARDS.has(card))
                }
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
            let {value_scores, normal_scores, final_value_cards: all_players_final_value_cards} = this.get_final_value()
            return {
                status: 0,
                msg: "游戏结束",
                normal_scores: normal_scores,
                value_scores: value_scores,
                all_players_final_value_cards: all_players_final_value_cards
            }
        }
        else {
            let friend_help_info = {
                is_friend_help: false
            }
            this.curr_player_id = (parseInt(curr_player_id) + 1) % NUM_PLAYERS
            while (this.all_players[this.curr_player_id].cards.length == 0) {
                this.continue_pass_cnts += 1
                this.curr_player_id = (this.curr_player_id + 1) % NUM_PLAYERS
            }
            /* 当上家出完手牌后的逻辑是这样
                如果朋友牌都出了，要是其他人要不起的话，下个出牌人是队友而不是下家
                如果朋友牌没出，要是其他人要不起的话，则下个出牌人是下家而不是队友
                如果其他人要的起，那就其他人出，包括队友，所以先过一轮是否要得起，如果过了一轮都没出牌，则按照朋友牌逻辑（即上面的逻辑）出牌
            */
            if(this.continue_pass_cnts >= NUM_PLAYERS - 1){
                // 如果出完牌了，都要不起，且没有朋友牌了，则下个玩家为朋友
                if (this.all_players[this.last_valid_player_id].cards.length == 0 && this.friend_card_cnt == 0) {
                    this.curr_player_id = this.friend_map[this.last_valid_player_id]
                    friend_help_info.is_friend_help = true
                    friend_help_info.player =  this.last_valid_player_id
                    friend_help_info.helped_friend = this.curr_player_id
                }
                this.is_start = true
                this.continue_pass_cnts = 0
            }
            else{
                this.is_start = false
            }

            if (this.is_start) {
                this.last_valid_cards_info = null
                this.last_valid_player_id = null
            }

            return {
                status: 1,
                msg: "游戏进行中",
                next_player_id: this.curr_player_id,
                friend_help_info: friend_help_info,
                value_cards: show_value_cards,
                cards_value: cards_value,
                rank: rank,
                final_value_cards: final_value_cards,
                friend_map: send_friend_map ? this.friend_map : null
            }
        }
    }

}

export default Game;
export {
    PlayerState,
    GameState
}