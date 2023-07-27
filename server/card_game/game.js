import { create_poker, get_all_zhadan, get_cards_value, get_card_name, get_card_rank, SPECIAL_CARDS, OutState } from "./card.js"
import Player from "./player.js"
import utils from "../utils.js"
import examples from "./test_cards.js"

const GameState = {
    "OutGame": 0,
    "InGame": 1,
    "Prepared": 2,
    "GameStart": 3, // or RoundEnd
    "RoundStart": 4,
    "RoundSkip": 5,
    "PlayerEnd": 6,
    "GameEnd": 7
}

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

    calc(cards) {
        // TODO: 连炸2222 3333算吗？
        let zhadans = get_all_zhadan(cards)
        for (let zhadan of zhadans) {
            this.update(zhadan, get_cards_value(zhadan))
        }

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
        this.num_rounds = 0
        this.global_players_score = Array(NUM_PLAYERS).fill(0)  // 全局得分
        this.init(null)
    }

    init(last_winner) {
        this.all_players = []

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
        this.friend_card_cnt = 2
    }

    get_first_player(last_winner) {
        if (last_winner === null) {
            this.first_player_id = Math.floor(Math.random() * NUM_PLAYERS);
        } else {
            this.first_player_id = last_winner;
        }
    }

    random_split_cards() {
        // TODO: 测试方便，先不shuffle
        // this.pokers = utils.shuffle(this.pokers)
        for (let i = NUM_PLAYERS - 1; i >= 0; i--) {
            this.all_players.push(
                new Player(examples["first"][i], false)
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
        // value_scores是赏，normal_scores涉及关双还是关单
        let value_scores = Array(NUM_PLAYERS).fill(0)
        let total_value = 0
        for (let i = 0; i < NUM_PLAYERS; i++) {
            let value = this.player_value_calculator[i].calc(this.all_players[i].cards)
            total_value += value
            value_scores[i] = value
        }

        let normal_scores = this.get_score_without_value()
        for (let i = 0; i < NUM_PLAYERS; i++) {
            this.players_score[i] = value_scores[i] * (NUM_PLAYERS - 1) - (total_value - value_scores[i]) + normal_scores[i]
            this.global_players_score[i] += this.players_score[i]
        }
        return {value_scores, normal_scores}
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
        let show_value_cards = null, joker_cards = null
        let rank = null
        if (out_state === OutState.VALID) {
            this.all_players[curr_player_id].cards = all_cards
            this.last_valid_cards_info = cards_info
            this.last_valid_player_id = curr_player_id
            this.player_value_calculator[curr_player_id].update(raw_cards, cards_value)

            const has_friend_card = raw_cards.some((card) => card == this.friend_card)

            if (has_friend_card) {
                this.friend_card_cnt -= 1
            }

            this.continue_pass_cnts = 0

            if (all_cards.length === 0) {
                // 当前玩家没有手牌了
                this.winners_order.push(curr_player_id)
                rank = this.winners_order.length
            }
            if (cards_value > 0) {
                // 有赏，就全部返回，包括王
                show_value_cards = raw_cards
                joker_cards = raw_cards.filter(card => SPECIAL_CARDS.has(card))
            }
            else if (raw_cards.some(card => SPECIAL_CARDS.has(card))) {
                // 无赏，就只返回王
                show_value_cards = raw_cards.filter(card => SPECIAL_CARDS.has(card))
                joker_cards = show_value_cards
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
            console.log("game over..")
            let {value_scores, normal_scores} = this.get_final_value()
            return {
                status: 0,
                msg: "游戏结束",
                normal_scores: normal_scores,
                value_scores: value_scores,
                value_cards: show_value_cards,
                cards_value: cards_value,
                rank: rank
            }
        }
        else {
            let is_friend_help = false
            let next_player_id = (curr_player_id + 1) % NUM_PLAYERS
            while (this.all_players[next_player_id].cards.length == 0) {
                this.continue_pass_cnts += 1
                next_player_id = (next_player_id + 1) % NUM_PLAYERS
            }
            /* 当上家出完手牌后的逻辑是这样
                如果朋友牌都出了，要是其他人要不起的话，下个出牌人是队友而不是下家
                如果朋友牌没出，要是其他人要不起的话，则下个出牌人是下家而不是队友
                如果其他人要的起，那就其他人出，包括队友，所以先过一轮是否要得起，如果过了一轮都没出牌，则按照朋友牌逻辑（即上面的逻辑）出牌
            */
            if(this.continue_pass_cnts >= NUM_PLAYERS - 1){
                // 如果出完牌了，都要不起，且没有朋友牌了，则下个玩家为朋友
                if (this.all_players[this.last_valid_player_id].cards.length == 0 && this.friend_card_cnt == 0) {
                    is_friend_help = true
                    next_player_id = this.friend_map[this.last_valid_player_id]
                }
                this.is_start = true
                this.continue_pass_cnts = 0
            }
            else{
                this.is_start = false
            }


            // const is_friend = (out_state == OutState.NO_CARDS) && (this.friend_map[next_player_id] === this.game_state.last_valid_player_id)
            // 如果回合结束还是自己 或者 朋友牌已出，当一方出完且下个用户是朋友时重置
            // this.is_start = this.is_start || is_friend

            if (this.is_start) {
                this.last_valid_cards_info = null
                this.last_valid_player_id = null
            }

            return {
                status: 1,
                msg: "游戏进行中",
                next_player_id: next_player_id,
                is_friend_help: is_friend_help,
                value_cards: show_value_cards,
                joker_cards: joker_cards,
                cards_value: cards_value,
                rank: rank
            }
        }
    }

}

export default Game;
export {
    GameState
}