exports.geneRoomNumber = (size=6) => {
    let room_number = ''
    for(let i = 0; i < size; i++) {
        room_number += Math.floor(Math.random() * 10) + ''
    }
    return room_number
}

exports.shuffle = (array) => {
    let currentIndex = array.length,  randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex != 0) {

      // Pick a remaining element.
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      // And swap it with the current element.
      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }

    return array;
  }