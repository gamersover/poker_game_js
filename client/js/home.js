function random_gene_player() {
    let player_name = Math.floor(Math.random() * 10)
    let player_icon = null
    return { player_name, player_icon }
}

let player_name = localStorage.getItem("player_name")
if (player_name === null) {
    let { player_name, player_icon } = random_gene_player()
    localStorage.setItem("player_name", player_name)
    localStorage.setItem("player_icon", player_icon)
}

function create_home() {
    location.href = "./play.html?func=create"
}

function join_home() {
    $(".input-pop").fadeIn(100)
    $(".main").fadeOut(100)
    $("#button-yes").click(function () {
        const room_number = $("#room-number").val()
        if (/^[0-9]{6}$/.exec(room_number)) {
            location.href = `./play.html?func=join&inputed_room_number=${room_number}`
        }
        else {
            alert("房间号必须为6为数字")
        }
    })

    $("#button-no").click(function () {
        $(".main").fadeIn(100)
        $(".input-pop").fadeOut(100)
    })
}