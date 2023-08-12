import {get_card_rank, get_card_color} from './card.js'


class Player{
    constructor(cards, is_robot=false){
        this.cards = cards.sort((a, b) => {
            if (get_card_rank(a) !== get_card_rank(b)) {
                return get_card_rank(a) - get_card_rank(b)
            }
            else {
                return get_card_color(a) > get_card_color(b) ? 1 : -1
            }
        })
        this.is_robot = is_robot
    }

    select_friend_card(){
        let card_count = {}
        for (let card of this.cards){
            card_count[card] = (card_count[card] || 0) + 1
        }
        let unique_cards = []
        for (let card in card_count) {
            if (card_count[card] == 1){
                unique_cards.push(card)
            }
        }
        return unique_cards[Math.floor(Math.random()*unique_cards.length)]
    }

    contain_friend_card(friend_card){
        return this.cards.includes(friend_card)
    }
}

export default Player;