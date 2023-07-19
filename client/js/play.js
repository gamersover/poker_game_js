function getSearchString(key, Url) {
    var str = Url;
    str = str.substring(1, str.length); // 获取URL中?之后的字符（去掉第一位的问号）
    // 以&分隔字符串，获得类似name=xiaoli这样的元素数组
    var arr = str.split("&");
    var obj = new Object();
    // 将每一个数组元素以=分隔并赋给obj对象
    for (var i = 0; i < arr.length; i++) {
        var tmp_arr = arr[i].split("=");
        obj[decodeURIComponent(tmp_arr[0])] = decodeURIComponent(tmp_arr[1]);
    }
    return obj[key];
}

function player_id_to_div(player_id) {
    diff = player_id - player_data.player_id
    // 即python中的%运算，a % b = a - (a // b) * b
    div_id = diff - Math.floor(diff / 4) * 4
    return `p${div_id + 1}`
}

function update_room_state(data, player_data) {
    for (let player_id in data.players_info) {
        div_name = player_id_to_div(player_id)
        $(`#${div_name} .player-name`).text(data.players_info[player_id].player_name)
        if (data.players_info[player_id].state >= 0) {
            $(`#${div_name} .player-info .left`).css("visibility", "visible")
        }
        if (data.players_info[player_id].state == 1) {
            $(`#${div_name} .player-icon img`).css("opacity", "1")
        }

        $("#room-number .rounded-rect").text(data.room_number)
    }
}


function get_next_card(all_cards, curr_card, offset) {
    offset = offset < 0 ? offset + all_cards.length : offset
    return all_cards[(all_cards.indexOf(curr_card) + offset) % all_cards.length]
}


function joker_change(jokers){
    $(".joker-change-pop").html("")
    for (let joker of jokers) {
        let change_cards = [$(joker).data("cardname").split('-')[0]]
        for (let c of NORMAL_CARDS) {
            change_cards.push(change_cards[0] + "-" + c)
        }
        let newitems = $("<div data-cardname=" + $(joker).data("cardname") + "><img src='./asset/poker/fronts/" + $(joker).data("cardname")+ ".svg'></div>")
        newitems.on("click", function() {
            let new_cardname = get_next_card(change_cards, $(this).data("cardname"), 1)
            $(this).html("<img src='./asset/poker/fronts/" + new_cardname + ".svg'>")
            $(this).data("cardname", new_cardname)
            $(joker).html("<img src='./asset/poker/fronts/" + new_cardname + ".svg'>")
            $(joker).data("cardname", new_cardname)
        })
        $(".joker-change-pop").append(newitems)
    }
}

function render_all_cards(all_cards, parent_class_name) {
    let n = all_cards.length;
    let unselected_trans_y = "30%";
    for (let i = 1; i <= n; i++) {
        let trans_x = (i - 1 - n / 2) * 30;
        $(`.${parent_class_name}`).append(`<div data-selected='false' data-cardname='${all_cards[i - 1]}' style='z-index: ${i}; transform: translate(${trans_x}%, ${unselected_trans_y})'><img src='./asset/poker/fronts/${all_cards[i - 1]}.svg'></div>`)
    }

    let selected_joker_cards = []
    $(`.${parent_class_name} div`).on("click", function () {
        let translateX = $(this).css('transform').split(',')[4]
        let selected = $(this).data('selected');
        let translateY = selected ? unselected_trans_y : "5%"
        $(this).data("selected", !selected)
        $(this).css('transform', 'translate(' + translateX + 'px, ' + translateY + ')')

        selected_joker_cards = []
        $(".cards div").each(function () {
            if ($(this).data('selected') === true && SPECIAL_CARDS.has($(this).data("cardname").split('-')[0])) {
                selected_joker_cards.push(this)
            }
        })

        if (selected_joker_cards.length > 0) {
            $(".joker-change-pop").css("visibility", "visible")
            joker_change(selected_joker_cards)
        }
        else {
            $(".joker-change-pop").css("visibility", "hidden")
        }
    })
}

function render_out_cards(out_cards, out_id, value_cards) {
    let n = out_cards.length;
    let trans_x = null;
    let trans_y = "0";
    if (out_id === "p1-out") {
        trans_y = "-30%"
    }
    else if (out_id === "p2-out" || out_id === "p4-out") {
        trans_y = "40%"
    }
    for (let i = 1; i <= n; i++) {
        if (out_id === "p1-out" || out_id === "p3-out") {
            trans_x = 80 + (i - 1) * 20
        }
        else if (out_id === "p2-out") {
            trans_x = 450 - (n - i) * 20
        }
        else {
            trans_x = (i - 1) * 20
        }
        if (value_cards && value_cards.includes(out_cards[i - 1])) {
            $(`#${out_id}`).append(`<div style='z-index: ${i}; transform: translate(${trans_x}%, ${trans_y})'><img class="card-border" src='./asset/poker/fronts/${out_cards[i - 1]}.svg'></div>`)
        }
        else {
            $(`#${out_id}`).append(`<div style='z-index: ${i}; transform: translate(${trans_x}%, ${trans_y})'><img src='./asset/poker/fronts/${out_cards[i - 1]}.svg'></div>`)
        }
    }
}

function render_out_text(out_id, out_text) {
    if (out_id === "p1-out") {
        $("#user-state").html(`<div class='out-text'><h4>${out_text}</h4><div>`).show()
    }
    else {
        let top = "0%";
        let left = "15%";
        if (out_id === "p2-out") {
            top = "25%";
            left = "84%";
        }
        else if (out_id === "p4-out") {
            top = "25%"
            left = "3%"
        }
        $(`#${out_id}`).html(`<div class='out-text' style='top: ${top}; left: ${left}'><h4>${out_text}</h4><div>`)
    }
}

function render_joker(joker_cards, out_id) {
    let trans_y;
    for (let i = 1; i <= joker_cards.length; i++) {
        if (out_id === "p1") {
            trans_y = 20 * (i - 1)
        }
        else {
            trans_y = -20 + 15 * (i - 1)
        }
        $(`#${out_id} .value-cards`).append(`<div style='z-index: ${i}; transform: translate(10%, ${trans_y}%)'><img src='./asset/poker/fronts/${joker_cards[i - 1]}.svg'></div>`)
    }
}

function render_last_player_state(last_player_div_name, data) {
    if (data.has_friend_card) {
        $('.friend-cards-left-cnt').text($('.friend-cards-left-cnt').text() - 1)
    }

    let last_raw_cards = rank_raw_cards(data.last_valid_cards)

    out_id = last_player_div_name + "-out"
    $(`#${out_id} div`).remove()
    render_out_cards(last_raw_cards, out_id, data.value_cards)

    if (data.rank) {
        $(`#${last_player_div_name} .cards`).append(`<h2>你的排名：${data.rank}</h2>`)
    }

    if (data.last_player_id !== player_data.player_id) {
        if (data.last_player_num_cards !== null) {
            $(`#${last_player_div_name} .num-cards`).text(data.last_player_num_cards)
        }
        else {
            $(`#${last_player_div_name} .num-cards`).text("?")
        }
    }

    if (data.value_cards) {
        // 给上个用户显示王牌
        let joker_cards = data.value_cards.filter((card) => SPECIAL_CARDS.has(card))
        render_joker(joker_cards, last_player_div_name)
    }

    if (data.cards_value > 0) {
        let old_value = $(`#${last_player_div_name} .delta-score`).text()
        if (old_value.length > 0) {
            old_value = parseInt(old_value)
        }
        else {
            old_value = 0
        }
        let new_value = data.cards_value + old_value
        $(`#${last_player_div_name} .delta-score`).text("+" + new_value)
        $(`#${last_player_div_name} .delta-score`).css("color", "green")
    }
}

let socket = null

const player_name = localStorage.getItem("player_name")
const func = getSearchString("func", location.search)

const player_data = {
    room_number: null,
    player_name: player_name,
    player_id: -1,
    is_prepared: false
}

function create_room() {
    if (player_data.room_number !== null) {
        alert(`你已在${player_data.room_number}房间，无法创建其他房间`)
    }
    else {
        socket = io(`ws://localhost:3001`, {
            // 显式指定websocket传输层
            transports: ['websocket']
        });

        socket.emit("create_room", {
            room_number: player_data.room_number,
            player_name: player_data.player_name
        })

        socket.on("create_room", (data) => {
            if (data.status == 1) {
                player_data.room_number = data.room_number
                player_data.player_name = data.player_name
                player_data.player_id = data.player_id
                update_room_state(data, player_data)
            }
        })

        socket.on("prepare_start_global", (data) => {
            // TODO: toast方式？update_and_show_messages(data.msg)
            if (data.status == 1) {
                update_room_state(data, player_data)
            }
        })

        socket.on("join_room_others", (data) => {
            // update_and_show_messages(data.msg)
            if (data.status === 1) {
                update_room_state(data, player_data)
            }
        })

        socket.on("disconnect", (data) => {
            // update_and_show_messages("服务器关闭，请稍后再试")
            socket.disconnect()
        })
    }
}

function join_room() {
    player_data.inputed_room_number = getSearchString("inputed_room_number", location.search)
    if (player_data.room_number !== null) {
        alert(`你已在${player_data.room_number}房间，无法加入其他房间`)
    }
    else if (/^[0-9]{6}$/.exec(player_data.inputed_room_number)) {
        socket = io('ws://localhost:3001', {
            // 显式指定websocket传输层
            transports: ['websocket']
        });

        socket.emit("join_room", {
            room_number: player_data.inputed_room_number,
            player_name: player_data.player_name
        })

        socket.on("join_room", (data) => {
            if (data.status == 1) {
                player_data.room_number = data.room_number
                player_data.player_name = data.player_name
                player_data.player_id = data.player_id
                update_room_state(data, player_data)
            }
            else {
                alert(`房间${data.room_number}未创建，无法加入`)
            }
        })

        socket.on("prepare_start_global", (data) => {
            if (data.status == 1) {
                update_room_state(data, player_data)
            }
        })

        socket.on("join_room_others", (data) => {
            if (data.status === 1) {
                update_room_state(data, player_data)
            }
        })

        socket.on("disconnect", (data) => {
            socket.disconnect()
        })
    }
    else {
        alert("房间号必须为6位数字")
    }
}

function prepare() {
    if (player_data.is_prepared) {
        alert(`你已在${player_data.room_number}准备`)
        return
    }

    socket.emit("prepare_start", {
        // room_number: player_data.room_number,
        // player_name: player_data.player_name,
        // player_id: player_data.player_id
    })

    socket.on("prepare_start", (data) => {
        if (data.status === 1) {
            $("#prepare").hide()
            player_data.is_prepared = true
            $("#user-state").html("<h2>已准备</h2>").show()
        }
        else {
            alert("准备失败，未加入任何房间")
        }
    })

    socket.on("game_start_global", (data) => {
        player_data.all_cards = data.all_cards
        player_data.curr_player_id = data.first_player_id
        player_data.curr_player_name = data.first_player_name
        player_data.friend_card = data.friend_card

        if (player_data.curr_player_id == player_data.player_id) {
            $("#pass").show()
            $("#go").show()
        }
        else {
            $("#pass").hide()
            $("#go").hide()
        }
        $("#user-state").hide()
        $(".player-info .right").css("visibility", "visible")

        $(`.cards div`).remove()
        render_all_cards(player_data.all_cards, "cards")

        $("#num-rounds").text(player_data.num_rounds)
        first_player_div_name = player_id_to_div(data.first_player_id)

        $(`#${first_player_div_name} .player-icon img`).addClass("icon-border")
        $(".friend-card").html(`<img src='./asset/poker/fronts/${player_data.friend_card}.svg'>`)
        $("#friend-info .rounded-rect").css("visibility", "visible")
    })

    socket.on("game_step", (data) => {
        $("#pass").show()
        $("#go").show()
        $("#user-state").html("")
        $("#p1-out div").remove()
        if (data.is_friend_help) {
            alert("由于朋友牌已出，得到朋友帮助")
        }
        player_data.last_valid_cards_info = data.last_valid_cards_info
        player_data.is_start = data.is_start
    })

    socket.on("game_step_global", (data) => {
        player_data.curr_player_id = data.curr_player_id
        player_data.curr_player_name = data.curr_player_name

        curr_player_div_name = player_id_to_div(data.curr_player_id)
        last_player_div_name = player_id_to_div(data.last_player_id)
        $(`#${last_player_div_name} .player-icon img`).removeClass("icon-border")
        $(`#${curr_player_div_name} .player-icon img`).addClass("icon-border")

        if (data.status === 1) {
            render_last_player_state(last_player_div_name, data)
        }
        else if (data.status === 2) {
            out_id = last_player_div_name + "-out"
            // $(`#${out_id} div`).remove()
            render_out_text(out_id, "要不起")
        }
    })

    socket.on("game_over_global", (data) => {
        if (data.status === 1) {
            last_player_div_name = player_id_to_div(data.last_player_id)
            render_last_player_state(last_player_div_name, data)
            for (let i = 0; i < data.game_result.length; i++) {
                let player_res = data.game_result[i]
                $(`.game-over-inner .w${i} .winner-name`).text(player_res.player_name)
                $(`.game-over-inner .w${i} .winner-basic-score`).text(player_res.normal_score)
                $(`.game-over-inner .w${i} .winner-value-score`).text(player_res.value_score)
                $(`.game-over-inner .w${i} .winner-score`).text(player_res.final_score)
                $(`.game-over-inner .w${i} .winner-total-score`).text(player_res.global_score)
            }
            $(".game-over-pop").css("visibility", "visible")
        }
    })
}

function game_step() {
    if (player_data.curr_player_name === player_data.player_name) {
        let raw_out_cards = []
        $(".cards div").each(function () {
            if ($(this).data('selected') === true) {
                raw_out_cards.push($(this).data("cardname"))
            }
        })

        let result = is_valid_out_cards(raw_out_cards, false, player_data.last_valid_cards_info, player_data.is_start)
        if (result.status === -1) {
            alert(result.msg)
        }
        else if (result.status === 0) {
            alert(result.msg)
        }
        else if (result.status === 1) {
            let has_friend_card = false
            for (let card of result.raw_cards) {
                player_data.all_cards.splice(player_data.all_cards.indexOf(card), 1)
                if (card === player_data.friend_card) {
                    has_friend_card = true
                }
            }

            $('.cards div').remove()
            render_all_cards(player_data.all_cards, "cards")

            $("#pass").hide()
            $("#go").hide()
            $(".joker-change-pop").html("").css("visibility", "hidden")
            $("#user-state").html("").show()

            socket.emit("game_step", {
                raw_out_cards: raw_out_cards,
                raw_cards: result.raw_cards,
                cards_info: result.cards_info,
                cards_value: result.cards_value,
                all_cards: player_data.all_cards,
                out_state: OutState.VALID,
                has_friend_card: has_friend_card
            })
        }
    }
    else {
        alert("非出牌时间")
    }
}

function game_pass() {
    if (player_data.curr_player_name === player_data.player_name) {
        var result = is_valid_out_cards(null, true, player_data.last_valid_cards_info, player_data.is_start, player_data.all_cards)
        if (result.status === 2) {
            $("#pass").hide()
            $("#go").hide()
            $(".joker-change-pop").html("")
            $(".joker-change-pop").css("visibility", "hidden")
            socket.emit("game_step", {
                out_state: OutState.PASS,
                // room_number: player_data.room_number,
                // curr_player_id: player_data.curr_player_id
            })
        }
        else if (result.status === -1) {
            alert("无法跳过，请选择出牌")
        }
    }
    else {
        alert("非出牌时间")
    }
}

$(".game-over-button button").on("click", function () {
    $(".game-over-pop").css("visibility", "hidden")
})


if (func === "create") {
    $(create_room)
}
else if (func === "join") {
    $(join_room)
}